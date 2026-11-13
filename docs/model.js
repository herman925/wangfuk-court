export const STATUS_LABELS = { available: '未揀選', picked: '已揀選' };
const analysisValue = (flat, field) => ({ winterSun: flat.lightview?.sun.winter.hours, sky: flat.lightview?.view.skyPct, water: flat.lightview?.view.waterPct })[field];

export function selectFlats(flats, filters = {}) {
  const number = (name, fallback) => filters[name] === '' || filters[name] == null ? fallback : Number(filters[name]);
  const minArea = number('minArea', 0), maxArea = number('maxArea', Infinity);
  const maxPrice = number('maxPrice', Infinity) * 10000;
  const minFloor = number('minFloor', 0), maxFloor = number('maxFloor', Infinity);
  const query = (filters.query || '').trim().toLocaleLowerCase();
  const rows = flats.filter(f => (!filters.estate || f.estate === filters.estate)
    && (!filters.block || f.block === filters.block)
    && f.sqft >= minArea && f.sqft <= maxArea && f.price <= maxPrice
    && f.floor >= minFloor && f.floor <= maxFloor
    && (!filters.status || f.status === filters.status)
    && (!filters.wishlistOnly || filters.wishlistIds?.has(f.id))
    && (!filters.facing || f.lightview?.living.facing === filters.facing)
    && (filters.minWinterSun == null || filters.minWinterSun === '' || (f.lightview && analysisValue(f, 'winterSun') >= Number(filters.minWinterSun)))
    && (filters.minSky == null || filters.minSky === '' || (f.lightview && analysisValue(f, 'sky') >= Number(filters.minSky)))
    && (filters.minWater == null || filters.minWater === '' || (f.lightview && analysisValue(f, 'water') >= Number(filters.minWater)))
    && (!query || `${f.estate} ${f.block} ${f.floor} ${f.unit} ${f.id}`.toLocaleLowerCase().includes(query)));
  const [field = 'price', direction = 'asc'] = (filters.sort || 'price-asc').split('-');
  return rows.sort((a, b) => {
    const left = a[field] ?? analysisValue(a, field), right = b[field] ?? analysisValue(b, field);
    if (left == null && right != null) return 1;
    if (left != null && right == null) return -1;
    const difference = typeof left === 'number' ? left - right : String(left).localeCompare(String(right), 'zh-HK', { numeric: true });
    return (direction === 'desc' ? -1 : 1) * difference || a.id.localeCompare(b.id, 'en', { numeric: true });
  });
}

export function toCsv(flats) {
  const quote = v => `"${String(v).replaceAll('"', '""')}"`;
  const rows = [['屋苑', '座', '樓層', '單位', '實用面積（平方呎）', '實用面積（平方米）', '價單售價（港元）', '揀選狀態', '來源狀態', '資料來源', '資料日期', '坐向（Lightview）', '夏至日照小時（模擬）', '春秋分日照小時（模擬）', '冬至日照小時（模擬）', '天空比例%（模擬）', '水面比例%（模擬）', 'Lightview來源', '城市模型日期'],
    ...flats.map(f => [f.estate, f.block, f.floor, f.unit, f.sqft, f.sqm, f.price, STATUS_LABELS[f.status], f.sourceStatus, f.source === 'official' ? '官方狀態表' : '使用者提供PDF', f.asOf,
      f.lightview?.living.facingZh ?? '', f.lightview?.sun.summer.hours ?? '', f.lightview?.sun.equinox.hours ?? '', f.lightview?.sun.winter.hours ?? '',
      f.lightview?.view.skyPct ?? '', f.lightview?.view.waterPct ?? '', f.lightview?.sourceUrl ?? '', f.lightview?.dataDate.cityModel ?? ''])];
  return '\uFEFF' + rows.map(row => row.map(quote).join(',')).join('\r\n');
}
