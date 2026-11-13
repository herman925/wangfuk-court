import { selectFlats, toCsv } from './model.js';

const $ = id => document.getElementById(id);
const ids = ['estate', 'block', 'minArea', 'maxArea', 'maxPrice', 'minFloor', 'maxFloor', 'verified', 'query', 'sort'];
const integer = new Intl.NumberFormat('zh-HK');
const money = price => (price / 10000).toLocaleString('zh-HK', { maximumFractionDigits: 2 });
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let snapshot, filtered = [], page = 1;
const pageSize = 50;

function filters() {
  return Object.fromEntries(ids.map(id => [id, id === 'verified' ? $(id).checked : $(id).value]));
}

function updateBlocks() {
  const estate = $('estate').value;
  const old = $('block').value;
  const blocks = [...new Set(snapshot.flats.filter(f => !estate || f.estate === estate).map(f => f.block))].sort();
  $('block').replaceChildren(new Option('全部座數', ''), ...blocks.map(b => new Option(b === '-' ? '不分座' : `${b}座`, b)));
  if (blocks.includes(old)) $('block').value = old;
}

function render() {
  const f = filters();
  filtered = selectFlats(snapshot.flats, f);
  const estate = snapshot.estates.find(e => e.name === f.estate);
  $('results-heading').textContent = estate ? estate.name : '全部屋苑';
  $('estate-note').textContent = estate ? `${estate.district} · 原先供選 ${estate.initial} 伙 · 本次快照餘 ${estate.remaining} 伙` : `10個屋苑 · 原先供選 ${integer.format(snapshot.initialCount)} 伙`;
  $('result-count').textContent = `找到 ${integer.format(filtered.length)} 伙符合條件的單位`;
  $('stat-count').textContent = integer.format(filtered.length);
  const prices = filtered.map(row => row.price), areas = filtered.map(row => row.sqft);
  $('stat-price').textContent = prices.length ? `${money(Math.min(...prices))}–${money(Math.max(...prices))}` : '—';
  $('stat-area').textContent = areas.length ? `${Math.min(...areas)}–${Math.max(...areas)}` : '—';
  $('verification-note').hidden = !filtered.some(row => row.verification !== 'official');
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  page = Math.min(page, pages);
  const start = (page - 1) * pageSize;
  $('flat-rows').innerHTML = filtered.slice(start, start + pageSize).map(row => `<tr><td><strong>${escape(row.estate)}</strong><small>${row.block === '-' ? '不分座' : `${escape(row.block)}座`}</small></td><td>${row.floor}樓 <strong>${escape(row.unit)}室</strong></td><td class="numeric"><strong>${row.sqft}</strong> 呎<small>${row.sqm} 平方米</small></td><td class="numeric"><strong>$${integer.format(row.price)}</strong><small>約 ${money(row.price)} 萬</small></td><td><span class="status ${row.verification === 'official' ? '' : 'estimated'}">${row.verification === 'official' ? '官方已核對' : '彙編推算'}</span></td></tr>`).join('');
  $('empty').hidden = filtered.length !== 0;
  $('page-info').textContent = filtered.length ? `${start + 1}–${Math.min(start + pageSize, filtered.length)} / ${integer.format(filtered.length)} 伙 · 第 ${page} / ${pages} 頁` : '0 伙';
  $('previous').disabled = page === 1;
  $('next').disabled = page === pages;
  $('download').disabled = filtered.length === 0;
}

function reset() {
  ids.forEach(id => { if (id === 'verified') $(id).checked = false; else $(id).value = id === 'sort' ? 'price-asc' : ''; });
  updateBlocks(); page = 1; render();
}

async function init() {
  try {
    const response = await fetch('./data/snapshot.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    snapshot = await response.json();
    if (!Array.isArray(snapshot.flats) || !Array.isArray(snapshot.estates) || !snapshot.flats.every(f => typeof f.price === 'number' && typeof f.sqft === 'number' && typeof f.floor === 'number')) throw new Error('資料格式不正確');
    $('snapshot-date').textContent = snapshot.asOf;
    snapshot.estates.forEach(e => $('estate').add(new Option(`${e.name} · ${e.district}（${e.remaining}伙）`, e.name)));
    $('source-list').innerHTML = `<ul>${snapshot.sources.map(s => `<li><a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.label)} ↗</a></li>`).join('')}</ul>`;
    $('snapshot-note').textContent = snapshot.note;
    updateBlocks();
    ids.forEach(id => $(id).addEventListener(id === 'query' || $(id).type === 'number' ? 'input' : 'change', () => {
      if (id === 'estate') { $('block').value = ''; updateBlocks(); }
      page = 1; render();
    }));
    $('reset').addEventListener('click', reset);
    $('toggle-filters').addEventListener('click', () => {
      const expanded = $('toggle-filters').getAttribute('aria-expanded') !== 'true';
      $('toggle-filters').setAttribute('aria-expanded', String(expanded));
      $('toggle-filters').textContent = expanded ? '收起進階篩選 −' : '展開面積、預算及樓層篩選 ＋';
      document.querySelector('.filters').classList.toggle('expanded', expanded);
    });
    $('empty-reset').addEventListener('click', reset);
    document.querySelectorAll('[data-area]').forEach(button => button.addEventListener('click', () => { $('minArea').value = button.dataset.area; $('maxArea').value = ''; page = 1; render(); }));
    $('previous').addEventListener('click', () => { page--; render(); });
    $('next').addEventListener('click', () => { page++; render(); });
    $('download').addEventListener('click', () => {
      const url = URL.createObjectURL(new Blob([toCsv(filtered)], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a'); a.href = url; a.download = `宏福苑選樓_${$('estate').value || '全部屋苑'}_${snapshot.asOf}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    render();
  } catch (error) {
    $('error').hidden = false;
    $('error').textContent = '未能載入單位資料，請重新整理網頁，或到 GitHub 查看資料快照。';
    $('result-count').textContent = '資料暫時無法載入';
    console.error(error);
  }
}
init();
