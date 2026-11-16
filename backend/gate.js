const ORIGIN = 'https://herman925.github.io';
const API = 'https://api.github.com/repos/herman925/wangfuk-court/actions/workflows/publish.yml';
const WORKFLOW = 'https://github.com/herman925/wangfuk-court/actions/workflows/publish.yml';
const RUN_PREFIX = 'https://github.com/herman925/wangfuk-court/actions/runs/';
const COOLDOWN = 30 * 60;

function reply(status, data) {
  return Response.json(data, { status, headers: {
    'Cache-Control': 'no-store',
    ...(data.retryAfter ? { 'Retry-After': String(data.retryAfter) } : {})
  } });
}

export async function handleRequest(request, env) {
  if (new URL(request.url).pathname !== '/refresh') return reply(404, { status: 'not-found' });
  if (request.headers.get('Origin') !== ORIGIN) return reply(403, { status: 'forbidden' });
  const cors = {
    'Access-Control-Allow-Origin': ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
  let response;
  if (request.method === 'OPTIONS') response = new Response(null, { status: 204 });
  else if (request.method !== 'POST') response = reply(405, { status: 'method-not-allowed' });
  else if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') {
    response = reply(415, { status: 'json-required' });
  } else {
    // The body cannot select a repository, branch or workflow; it is never read.
    request.body?.cancel().catch(() => {});
    try { response = await env.REFRESH_GATE.getByName('global').fetch('https://gate/refresh'); }
    catch { response = reply(503, { status: 'unavailable' }); }
  }
  response = new Response(response.body, response);
  for (const [key, value] of Object.entries(cors)) response.headers.set(key, value);
  return response;
}

export async function dispatchRefresh(kv, env, githubFetch = fetch, now = Date.now()) {
  if (!env.GITHUB_TOKEN) return reply(503, { status: 'not-configured' });
  const previous = kv.get('gate');
  if (previous?.nextAllowedAt > now) return reply(429, {
    status: 'cooldown', nextAllowedAt: previous.nextAllowedAt,
    retryAfter: Math.ceil((previous.nextAllowedAt - now) / 1000), runUrl: previous.runUrl
  });
  const gate = { nextAllowedAt: now + COOLDOWN * 1000, runUrl: WORKFLOW };
  // Synchronous Durable Object storage reserves the global slot before any network await.
  kv.put('gate', gate);
  const options = {
    headers: {
      Accept: 'application/vnd.github+json', Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2026-03-10', 'User-Agent': 'wangfuk-court-refresh'
    },
    signal: AbortSignal.timeout(10000)
  };
  try {
    const runs = await githubFetch(`${API}/runs?branch=main&per_page=20`, options);
    if (!runs.ok) throw new Error('runs-unavailable');
    const active = (await runs.json()).workflow_runs.find(run => run.status !== 'completed' && ['workflow_dispatch', 'schedule'].includes(run.event));
    if (active) {
      if (!Number.isSafeInteger(active.id) || active.id <= 0) throw new Error('invalid-run');
      gate.runUrl = `${RUN_PREFIX}${Number(active.id)}`;
    } else {
      const result = await githubFetch(`${API}/dispatches`, {
        ...options, signal: AbortSignal.timeout(10000), method: 'POST',
        headers: { ...options.headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: 'main' })
      });
      if (![200, 204].includes(result.status)) throw new Error('dispatch-unavailable');
      if (result.status === 200) {
        const run = await result.json();
        if (Number.isSafeInteger(run.workflow_run_id) && run.workflow_run_id > 0) gate.runUrl = `${RUN_PREFIX}${run.workflow_run_id}`;
      }
    }
    kv.put('gate', gate);
    return reply(202, { status: active ? 'running' : 'accepted', ...gate, retryAfter: COOLDOWN });
  } catch {
    // Keep the cooldown after an uncertain dispatch result to avoid duplicate executions.
    return reply(502, { status: 'upstream-failed', ...gate, retryAfter: COOLDOWN });
  }
}
