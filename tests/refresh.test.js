import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchRefresh, handleRequest } from '../backend/gate.js';
import { requestRefresh, mountRefresh } from '../docs/refresh.js';

const env = { GITHUB_TOKEN: 'test-secret' };
const clock = 100000;
function storage() {
  const values = new Map();
  return { get: key => structuredClone(values.get(key)), put: (key, value) => values.set(key, structuredClone(value)) };
}
const emptyRuns = () => Response.json({ workflow_runs: [] });

test('public gate rejects other origins, methods and simple form submissions before reaching GitHub', async () => {
  let called = 0;
  const bound = { REFRESH_GATE: { getByName: name => {
    assert.equal(name, 'global');
    return { fetch: () => { called++; return Response.json({ status: 'accepted' }, { status: 202 }); } };
  } } };
  const request = (method, origin, type, path = '/refresh') => new Request(`https://worker.test${path}`, {
    method, headers: { ...(origin ? { Origin: origin } : {}), 'Content-Type': type }
  });
  for (const origin of [null, 'https://evil.test', 'https://herman925.github.io.evil.test']) {
    assert.equal((await handleRequest(request('POST', origin, 'application/json'), bound)).status, 403);
  }
  const origin = 'https://herman925.github.io';
  assert.equal((await handleRequest(request('GET', origin, 'application/json'), bound)).status, 405);
  assert.equal((await handleRequest(request('POST', origin, 'text/plain'), bound)).status, 415);
  assert.equal((await handleRequest(request('POST', origin, 'application/json', '/other'), bound)).status, 404);
  const preflight = await handleRequest(request('OPTIONS', origin, 'application/json'), bound);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal(called, 0);
  assert.equal((await handleRequest(request('POST', origin, 'application/json'), bound)).status, 202);
  assert.equal(called, 1);
});

test('only fixed main workflow is dispatched, simultaneous visitors share a persisted 30 minute cooldown', async () => {
  const kv = storage(), calls = [];
  const github = async (url, options) => {
    calls.push([url, options]);
    await new Promise(resolve => setTimeout(resolve, 5));
    return url.includes('/runs?') ? emptyRuns() : Response.json({ workflow_run_id: 123 });
  };
  const responses = await Promise.all(Array.from({ length: 12 }, () => dispatchRefresh(kv, env, github, clock)));
  assert.deepEqual(responses.map(r => r.status), [202, ...Array(11).fill(429)]);
  assert.equal(calls.length, 2);
  assert.equal(calls[1][0], 'https://api.github.com/repos/herman925/wangfuk-court/actions/workflows/publish.yml/dispatches');
  assert.equal(calls[1][1].method, 'POST');
  assert.equal(calls[1][1].body, '{"ref":"main"}');
  assert.equal((await responses[0].json()).runUrl, 'https://github.com/herman925/wangfuk-court/actions/runs/123');
  const blocked = await dispatchRefresh(kv, env, github, clock + 1799999);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('Retry-After'), '1');
  assert.equal((await dispatchRefresh(kv, env, github, clock + 1800000)).status, 202);
});

test('active data refresh is reused, but a push-only publication does not swallow a refresh request', async () => {
  let posts = 0;
  const github = event => async (url, options) => {
    if (options.method === 'POST') { posts++; return new Response(null, { status: 204 }); }
    return Response.json({ workflow_runs: [{ id: 321, status: 'in_progress', event }] });
  };
  const running = await dispatchRefresh(storage(), env, github('schedule'), clock);
  assert.equal((await running.json()).status, 'running');
  assert.equal(posts, 0);
  await dispatchRefresh(storage(), env, github('push'), clock);
  assert.equal(posts, 1);
});

test('missing credentials fail closed and GitHub failures never leak secrets or permit immediate retry', async () => {
  assert.equal((await dispatchRefresh(storage(), {}, () => assert.fail('no network'), clock)).status, 503);
  for (const failure of ['network', 'denied', 'ambiguous']) {
    const kv = storage();
    const github = async (url) => {
      if (failure === 'network') throw new Error('test-secret');
      if (failure === 'denied') return new Response('test-secret', { status: 403 });
      if (url.includes('/runs?')) return emptyRuns();
      throw new Error('test-secret');
    };
    const response = await dispatchRefresh(kv, env, github, clock);
    assert.equal(response.status, 502);
    assert.ok(!(await response.text()).includes('test-secret'));
    assert.equal((await dispatchRefresh(kv, env, () => assert.fail('cooldown must survive'), clock + 1)).status, 429);
  }
});

test('frontend sends no credentials or configurable target; validates progress links and displays cooldown/failure', async () => {
  const accepted = await requestRefresh(async (url, options) => {
    assert.ok(url.startsWith('https://'));
    assert.equal(options.method, 'POST');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.body, '{}');
    assert.equal(options.headers.Authorization, undefined);
    return Response.json({ status: 'accepted', nextAllowedAt: 2000, runUrl: 'https://evil.test/' }, { status: 202 });
  });
  assert.match(accepted.message, /已提出/);
  assert.equal(accepted.runUrl, 'https://github.com/herman925/wangfuk-court/actions/workflows/publish.yml');
  const cooling = await requestRefresh(async () => Response.json({ status: 'cooldown', nextAllowedAt: 3000 }, { status: 429 }));
  assert.match(cooling.message, /冷卻/);
  assert.equal(cooling.nextAllowedAt, 3000);
  assert.match((await requestRefresh(async () => Response.json({ status: 'upstream-failed' }, { status: 502 }))).message, /未能確認/);
});

test('button handles network failure without claiming update success and permits another attempt', async () => {
  let click;
  const button = { disabled: true, addEventListener: (_, callback) => { click = callback; }, setAttribute() {}, removeAttribute() {} };
  const feedback = {}, progress = {};
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('offline'); };
  try {
    mountRefresh(button, feedback, progress);
    assert.equal(button.disabled, false);
    const pending = click();
    assert.equal(button.disabled, true);
    await pending;
    assert.equal(button.disabled, false);
    assert.match(feedback.textContent, /未能確認/);
  } finally { globalThis.fetch = original; }
});
