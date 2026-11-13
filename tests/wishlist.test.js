import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeWishlist, parseWishlist, wishlistText } from '../docs/wishlist.js';
import { selectFlats } from '../docs/model.js';

const flats = JSON.parse(readFileSync(new URL('../docs/data/snapshot.json', import.meta.url), 'utf8')).flats;

test('WhatsApp text round-trips every special-exercise identity, including blocks and no-block estates', () => {
  const text = wishlistText(flats);
  assert.deepEqual(parseWishlist(text, flats).ids, flats.map(flat => flat.id));
  assert.ok(text.includes('*心許之所｜宏福苑選樓清單*'));
  assert.ok(text.includes('不分座') && text.includes('HK$') && text.includes('使用者PDF'));
  assert.equal(wishlistText([]), '');
  assert.equal(parseWishlist('', flats).ids.length, 0);
});

test('import deduplicates, tolerates forwarded formatting and rejects unknown or malformed units', () => {
  const flat = flats[0], text = wishlistText([flat]);
  const forwarded = text.split('\n').map(line => '> ' + line).join('\r\n');
  const parsed = parseWishlist(forwarded + '\n' + text + '\n【不存在苑｜A座｜1樓｜1室】\n【啟陽苑｜A座｜999樓｜1室】', flats);
  assert.deepEqual(parsed.ids, [flat.id]);
  assert.equal(parsed.duplicates, 1);
  assert.equal(parsed.unmatched.length, 2);
  assert.equal(parseWishlist('<script>alert(1)</script> 已選單位：abc', flats).ids.length, 0);
  assert.throws(() => parseWishlist('a'.repeat(2000001), flats));
});

test('import normalizes spacing and full-width numerals without using shared prices or sale statuses', () => {
  const flat = flats.find(flat => flat.estate === '啟陽苑' && flat.block === 'A' && flat.floor === 3 && flat.unit === '5');
  const parsed = parseWishlist('1. *【 啟陽苑 ｜ Ａ座 ｜ ３樓 ｜ ５室 】*\n免費｜已售｜2099-01-01', flats);
  assert.deepEqual(parsed.ids, [flat.id]);
  assert.equal(flats.find(row => row.id === parsed.ids[0]), flat);
  assert.equal(typeof parsed.ids[0], 'string');
});

test('stored wishlist validates its version, removes duplicates and limits membership to the inventory', () => {
  assert.deepEqual([...decodeWishlist(null, flats)], []);
  assert.deepEqual([...decodeWishlist(JSON.stringify({ version: 1, ids: [flats[0].id, flats[0].id, 'unknown'] }), flats)], [flats[0].id]);
  for (const value of ['bad JSON', 'null', '{"version":2,"ids":[]}', '{"version":1,"ids":[1]}']) assert.throws(() => decodeWishlist(value, flats));
  assert.throws(() => decodeWishlist(JSON.stringify({ version: 1, ids: Array(10001).fill('x') }), flats));
});

test('wishlist filter combines with status, estate and budget and handles an empty list', () => {
  const available = { ...flats[0], status: 'available' };
  const picked = { ...flats[1], status: 'picked' };
  const fixture = [available, picked];
  const wishlistIds = new Set([available.id, picked.id]);
  assert.equal(selectFlats(fixture, { wishlistOnly: true, wishlistIds }).length, 2);
  assert.deepEqual(selectFlats(fixture, { wishlistOnly: true, wishlistIds, status: 'picked', estate: picked.estate }).map(flat => flat.id), [picked.id]);
  assert.equal(selectFlats(fixture, { wishlistOnly: true, wishlistIds, maxPrice: '0' }).length, 0);
  assert.equal(selectFlats(fixture, { wishlistOnly: true, wishlistIds: new Set() }).length, 0);
  assert.equal(selectFlats(fixture, { wishlistOnly: false, wishlistIds }).length, fixture.length);
});
