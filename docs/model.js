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
    && (!filters.verified || f.verification === 'official')
    && (!query || `${f.estate} ${f.block} ${f.floor} ${f.unit} ${f.id}`.toLocaleLowerCase().includes(query)));
  const [field = 'price', direction = 'asc'] = (filters.sort || 'price-asc').split('-');
  const compare = (a, b) => typeof a[field] === 'number' ? a[field] - b[field] : String(a[field]).localeCompare(String(b[field]), 'zh-HK', { numeric: true });
  return rows.sort((a, b) => (direction === 'desc' ? -1 : 1) * compare(a, b) || a.id.localeCompare(b.id, 'en', { numeric: true }));
}

export function toCsv(flats) {
  const quote = v => `"${String(v).replaceAll('"', '""')}"`;
  const rows = [['屋苑', '座', '樓層', '單位', '實用面積（平方呎）', '實用面積（平方米）', '售價（港元）', '核實狀態', '資料日期'],
    ...flats.map(f => [f.estate, f.block, f.floor, f.unit, f.sqft, f.sqm, f.price, f.verification === 'official' ? '官方未售表已核對' : '按已選彙編推算', f.asOf])];
  return '\uFEFF' + rows.map(row => row.map(quote).join(',')).join('\r\n');
}
