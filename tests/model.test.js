import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectFlats, toCsv } from '../docs/model.js';

const snapshot = JSON.parse(readFileSync(new URL('../docs/data/snapshot.json', import.meta.url), 'utf8'));
test('snapshot contains unique, valid inventory keys and estate totals', () => {
  const inventory = JSON.parse(readFileSync(new URL('../data/inventory.json', import.meta.url), 'utf8'));
  assert.deepEqual(new Set(snapshot.flats.map(f => f.id)), new Set(inventory.map(f => f.id)));
  assert.equal(new Set(snapshot.flats.map(f => f.id)).size, snapshot.flats.length);
  for (const e of snapshot.estates) {
    assert.equal(selectFlats(snapshot.flats, { estate: e.name }).length, e.initial);
    for (const status of ['available', 'picked']) assert.equal(selectFlats(snapshot.flats, { estate: e.name, status }).length, e[status]);
  }
  assert.ok(snapshot.flats.every(f => f.source === (f.estate === '樂嶺軒' ? 'user-pdf' : 'official')));
});
test('estate, budget, area and floor constraints combine inclusively', () => {
  const rows = selectFlats(snapshot.flats, { estate: '灝然', minArea: '400', maxPrice: '450', minFloor: '5', maxFloor: '15' });
  assert.ok(rows.length > 0);
  assert.ok(rows.every(f => f.estate === '灝然' && f.sqft >= 400 && f.price <= 4500000 && f.floor >= 5 && f.floor <= 15));
});
test('numeric sorting, zero budget, reverse bounds and selection status filter', () => {
  const fixture = [{ id: 'a', estate: '甲', block: 'A', floor: 2, unit: '2', sqft: 400, price: 900000, status: 'available' }, { id: 'b', estate: '甲', block: 'B', floor: 10, unit: '10', sqft: 500, price: 1100000, status: 'picked' }];
  assert.deepEqual(selectFlats(fixture, { sort: 'floor-desc' }).map(f => f.floor), [10, 2]);
  assert.equal(selectFlats(fixture, { maxPrice: '90' }).length, 1);
  assert.equal(selectFlats(fixture, { maxPrice: '0' }).length, 0);
  assert.equal(selectFlats(fixture, { minArea: '500', maxArea: '400' }).length, 0);
  assert.deepEqual(selectFlats(fixture, { status: 'available' }).map(f => f.id), ['a']);
  assert.deepEqual(selectFlats(fixture, { status: 'picked' }).map(f => f.id), ['b']);
  assert.equal(selectFlats(fixture, { block: 'B' }).length, 1);
  assert.equal(selectFlats(fixture, { query: '甲' }).length, 2);
  assert.deepEqual(fixture.map(f => f.floor), [2, 10]);
});
test('CSV includes the whole filtered result, BOM and quoted cells', () => {
  const rows = selectFlats(snapshot.flats, { estate: '啟陽苑' });
  const csv = toCsv(rows);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.equal(csv.split('\r\n').length, rows.length + 1);
  assert.ok(csv.includes('已揀選') && csv.includes('未揀選') && csv.includes('官方狀態表'));
  assert.ok(toCsv(selectFlats(snapshot.flats, { estate: '樂嶺軒' })).includes('使用者提供PDF'));
  assert.ok(toCsv([{ ...rows[0], unit: 'a"b' }]).includes('"a""b"'));
});

test('simulation filters exclude missing data, preserve zero, and sort missing last', () => {
  const extra = JSON.parse(readFileSync(new URL('../docs/data/lightview.json', import.meta.url), 'utf8'));
  const merged = snapshot.flats.map(f => ({ ...f, lightview: extra.flats[f.id] }));
  assert.equal(selectFlats(merged, { minWinterSun: '0' }).length, Object.keys(extra.flats).length);
  const choice = merged.find(f => f.lightview);
  const facing = choice.lightview.living.facing;
  const hours = choice.lightview.sun.winter.hours, sky = choice.lightview.view.skyPct;
  const rows = selectFlats(merged, { estate: choice.estate, status: choice.status, facing, minWinterSun: String(hours), minSky: String(sky), minWater: '0' });
  assert.ok(rows.length > 0);
  assert.ok(rows.every(f => f.status === choice.status && f.lightview.living.facing === facing && f.lightview.sun.winter.hours >= hours && f.lightview.view.skyPct >= sky));
  for (const sort of ['winterSun-asc', 'winterSun-desc', 'sky-desc', 'water-desc']) {
    const sorted = selectFlats(merged, { sort });
    assert.ok(sorted[0].lightview);
    assert.ok(!sorted.at(-1).lightview);
  }
  const zero = { ...choice, lightview: { ...choice.lightview, sun: { ...choice.lightview.sun, winter: { hours: 0 } } } };
  assert.equal(toCsv([zero]).split('\r\n')[1].split(',')[14], '"0"');
  assert.equal(selectFlats(merged).length, 4443);
});
