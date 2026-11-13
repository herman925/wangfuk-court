import { STATUS_LABELS } from './model.js?v=20261113-wishlist';

export const WISHLIST_KEY = 'wangfuk-court:wishlist:v1';
const flatLabel = flat => `${flat.estate}｜${flat.block === '-' ? '不分座' : `${flat.block}座`}｜${flat.floor}樓｜${flat.unit}室`;
const normalize = text => text.normalize('NFKC').replace(/[\s\u200b-\u200f\uFEFF]/gu, '').toUpperCase();

export function decodeWishlist(raw, flats) {
  if (raw == null) return new Set();
  const data = JSON.parse(raw);
  if (data?.version !== 1 || !Array.isArray(data.ids) || data.ids.length > 10000 || !data.ids.every(id => typeof id === 'string')) throw new Error('已存清單格式不正確');
  const allowed = new Set(flats.map(flat => flat.id));
  return new Set(data.ids.filter(id => allowed.has(id)));
}

export function wishlistText(flats) {
  if (!flats.length) return '';
  const money = new Intl.NumberFormat('zh-HK');
  const entries = flats.map((flat, index) => [
    `${index + 1}. *【${flatLabel(flat)}】*`,
    `   ${flat.sqft}呎｜價單售價 HK$${money.format(flat.price)}`,
    `   ${flat.status === 'available' ? '🟢' : '🔴'} ${STATUS_LABELS[flat.status]}｜${flat.source === 'official' ? '官方狀態表' : '使用者PDF'} ${flat.asOf}`,
    ...(flat.lightview ? [`   客廳向${flat.lightview.living.facingZh}｜冬至日照 ${flat.lightview.sun.winter.hours}小時（Lightview模擬）`] : []),
  ].join('\n'));
  return ['*心許之所｜宏福苑選樓清單*', '願與你共看窗前晨光，共議往後日常。', '', ...entries.flatMap(entry => [entry, '']),
    `共 ${flats.length} 伙收藏，只屬心儀選擇，並非預留或官方揀選。`,
    '售價及揀選狀態會變動，以售樓處確認為準。',
    'https://herman925.github.io/wangfuk-court/',
    '把整份文字貼到網站「匯入清單」，即可加入心許之所。'].join('\n');
}

export function parseWishlist(text, flats) {
  if (typeof text !== 'string' || text.length > 2000000) throw new Error('清單太長，請分批匯入。');
  const allowed = new Map(flats.map(flat => [normalize(flatLabel(flat)), flat.id]));
  const ids = new Set(), unmatched = new Set();
  let duplicates = 0;
  for (const match of text.matchAll(/【([^【】\r\n]+)】/gu)) {
    const id = allowed.get(normalize(match[1]));
    if (!id) unmatched.add(match[1]);
    else if (ids.has(id)) duplicates++;
    else ids.add(id);
  }
  return { ids: [...ids], unmatched: [...unmatched], duplicates };
}
