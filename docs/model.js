export const STATUS_LABELS = { available: '未揀選', picked: '已揀選' };

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
    && (!query || `${f.estate} ${f.block} ${f.floor} ${f.unit} ${f.id}`.toLocaleLowerCase().includes(query)));
  const [field = 'price', direction = 'asc'] = (filters.sort || 'price-asc').split('-');
  const compare = (a, b) => typeof a[field] === 'number' ? a[field] - b[field] : String(a[field]).localeCompare(String(b[field]), 'zh-HK', { numeric: true });
  return rows.sort((a, b) => (direction === 'desc' ? -1 : 1) * compare(a, b) || a.id.localeCompare(b.id, 'en', { numeric: true }));
}

export function toCsv(flats) {
  const quote = v => `"${String(v).replaceAll('"', '""')}"`;
  const rows = [['屋苑', '座', '樓層', '單位', '實用面積（平方呎）', '實用面積（平方米）', '價單售價（港元）', '揀選狀態', '來源狀態', '資料來源', '資料日期'],
    ...flats.map(f => [f.estate, f.block, f.floor, f.unit, f.sqft, f.sqm, f.price, STATUS_LABELS[f.status], f.sourceStatus, f.source === 'official' ? '官方狀態表' : '使用者提供PDF', f.asOf])];
  return '\uFEFF' + rows.map(row => row.map(quote).join(',')).join('\r\n');
}
