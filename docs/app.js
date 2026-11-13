import { selectFlats, toCsv, STATUS_LABELS } from './model.js?v=20261113-auto';

const $ = id => document.getElementById(id);
const ids = ['estate', 'status', 'block', 'minArea', 'maxArea', 'maxPrice', 'minFloor', 'maxFloor', 'facing', 'minWinterSun', 'minSky', 'minWater', 'query', 'sort'];
const integer = new Intl.NumberFormat('zh-HK');
const money = price => (price / 10000).toLocaleString('zh-HK', { maximumFractionDigits: 2 });
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let snapshot, filtered = [], page = 1;
const pageSize = 50;

function filters() {
  return Object.fromEntries(ids.map(id => [id, $(id).value]));
}

function updateBlocks() {
  const estate = $('estate').value;
  const old = $('block').value;
  const blocks = [...new Set(snapshot.flats.filter(f => !estate || f.estate === estate).map(f => f.block))].sort();
  $('block').replaceChildren(new Option('全部座數', ''), ...blocks.map(b => new Option(b === '-' ? '不分座' : `${b}座`, b)));
  if (blocks.includes(old)) $('block').value = old;
}

function analysisCell(row) {
  const data = row.lightview;
  if (!data) return '<span class="analysis-missing">未有可配對分析</span>';
  const seasons = [['summer', '夏至'], ['equinox', '春秋分'], ['winter', '冬至']];
  const confidence = { medium: '中等', high: '高', low: '低' };
  return `<details class="lightview-info"><summary>${escape(data.living.facingZh)} · 冬日 ${data.sun.winter.hours} 小時<small>Lightview 模擬 · 查看詳情</small></summary><div class="lightview-details"><p class="analysis-caption">晴天直射陽光（小時）</p><dl>${seasons.map(([key, name]) => `<div><dt>${name}</dt><dd>${data.sun[key].hours}<small>早 ${data.sun[key].morningHours} ／ 午後 ${data.sun[key].afternoonHours}</small></dd></div>`).join('')}</dl><p class="analysis-caption">窗外120°景觀比例（模擬）</p><dl class="view-shares">${[['skyPct', '天空'], ['waterPct', '水面'], ['greeneryPct', '綠化'], ['buildingPct', '樓景'], ['otherPct', '其他']].map(([key, name]) => `<div><dt>${name}</dt><dd>${data.view[key]}%</dd></div>`).join('')}</dl><p class="analysis-caption">城市模型 ${escape(data.dataDate.cityModel || '未註明日期')} · 信心程度：日照 ${escape(confidence[data.sunConfidence] || data.sunConfidence)}／景觀 ${escape(confidence[data.viewConfidence] || data.viewConfidence)}</p><a href="${escape(data.sourceUrl)}&v=1" target="_blank" rel="noopener noreferrer">在 Lightview 看全景／3D ↗</a><p class="analysis-caption">來源：光景 Lightview · JOL Studio Limited。模擬僅供參考，未計雲及煙霞，並非實景或官方售樓資料。</p></div></details>`;
}

function render() {
  const f = filters();
  filtered = selectFlats(snapshot.flats, f);
  const estate = snapshot.estates.find(e => e.name === f.estate);
  $('results-heading').textContent = estate ? estate.name : '全部屋苑';
  $('estate-note').textContent = estate ? `${estate.district} · 特設供選 ${estate.initial} 伙 · 未揀選 ${estate.available} 伙` : `10個項目 · 特設供選範圍 ${integer.format(snapshot.initialCount)} 伙`;
  $('result-count').textContent = `找到 ${integer.format(filtered.length)} 伙符合條件的單位`;
  $('stat-count').textContent = integer.format(filtered.length);
  $('mobile-count').textContent = `${integer.format(filtered.length)}伙`;
  $('apply-filters').textContent = `顯示 ${integer.format(filtered.length)} 伙結果`;
  const prices = filtered.map(row => row.price), areas = filtered.map(row => row.sqft);
  $('stat-price').textContent = prices.length ? `${money(Math.min(...prices))}–${money(Math.max(...prices))}` : '—';
  $('stat-area').textContent = areas.length ? `${Math.min(...areas)}–${Math.max(...areas)}` : '—';
  $('verification-note').hidden = !filtered.some(row => row.source === 'user-pdf');
  const sierra = snapshot.flats.find(row => row.source === 'user-pdf');
  $('verification-note').textContent = sierra ? `樂嶺軒狀態採用使用者提供的 ${sierra.asOf} 已選PDF，並非官方完整選樓表；只計特設計劃供選的300伙。` : '';
  $('status-counts').innerHTML = Object.entries(STATUS_LABELS).map(([state, label]) => `<span class="status ${state}">${label} ${integer.format(filtered.filter(row => row.status === state).length)} 伙</span>`).join('');
  $('analysis-coverage').textContent = `其中 ${integer.format(filtered.filter(row => row.lightview).length)} 伙有可配對的 Lightview 日照及景觀模擬；缺少或面積不符的資料不套用。`;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  page = Math.min(page, pages);
  const start = (page - 1) * pageSize;
  $('flat-rows').innerHTML = filtered.slice(start, start + pageSize).map(row => `<tr role="row"><td role="cell"><strong>${escape(row.estate)}</strong><small>${row.block === '-' ? '不分座' : `${escape(row.block)}座`}</small></td><td role="cell">${row.floor}樓 <strong>${escape(row.unit)}室</strong></td><td role="cell" class="numeric" data-label="實用面積"><strong>${row.sqft}</strong> 呎<small>${row.sqm} 平方米</small></td><td role="cell" class="numeric" data-label="價單售價（港元）"><strong>$${integer.format(row.price)}</strong><small>約 ${money(row.price)} 萬</small></td><td role="cell" class="status-cell"><span class="status ${row.status}">${STATUS_LABELS[row.status]}</span><small>${row.source === 'official' ? `官方${escape(row.sourceStatus)}` : '使用者提供PDF'} · ${escape(row.asOf)}</small></td><td role="cell" class="analysis-cell">${analysisCell(row)}</td></tr>`).join('');
  $('empty').hidden = filtered.length !== 0;
  $('page-info').textContent = filtered.length ? `${start + 1}–${Math.min(start + pageSize, filtered.length)} / ${integer.format(filtered.length)} 伙 · 第 ${page} / ${pages} 頁` : '0 伙';
  $('previous').disabled = page === 1;
  $('next').disabled = page === pages;
  $('download').disabled = filtered.length === 0;
}

function reset() {
  ids.forEach(id => { $(id).value = id === 'sort' ? 'price-asc' : ''; });
  updateBlocks(); page = 1; render();
}

async function showRefreshStatus() {
  try {
    const response = await fetch('./data/update-status.json', { cache: 'no-cache' });
    if (!response.ok) return;
    const status = await response.json();
    const labels = { selection: '官方揀選狀態', lightview: 'Lightview', sierra: '樂嶺軒公告' };
    const time = date => date ? new Date(date).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', hour12: false }) : '未有成功記錄';
    $('refresh-note').textContent = `每日香港時間12:23、18:23及21:23自動檢查。${Object.entries(labels).map(([key, label]) => {
      const result = status[key];
      return result ? `${label}：${result.outcome === 'success' ? `已檢查 ${time(result.lastSuccessAt)}` : `本次失敗，保留上次資料（最後成功 ${time(result.lastSuccessAt)}）`}` : `${label}：未有記錄`;
    }).join('；')}。來源未發布新資料時，表內資料日期不會改動；樂嶺軒公告只作監察。`;
  } catch (error) {
    console.warn('自動檢查記錄暫未能載入。', error);
  }
}

async function init() {
  try {
    const response = await fetch('./data/snapshot.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    snapshot = await response.json();
    if (snapshot.schemaVersion !== 2 || !Array.isArray(snapshot.flats) || !Array.isArray(snapshot.estates) || !snapshot.flats.every(f => f.status in STATUS_LABELS && typeof f.price === 'number' && typeof f.sqft === 'number' && typeof f.floor === 'number')) throw new Error('資料格式不正確');
    try {
      const extraResponse = await fetch('./data/lightview.json', { cache: 'no-cache' });
      if (!extraResponse.ok) throw new Error('Lightview data unavailable');
      const extra = await extraResponse.json();
      if (extra.schemaVersion !== 1 || !extra.flats) throw new Error('Invalid Lightview data');
      snapshot.flats = snapshot.flats.map(flat => ({ ...flat, lightview: extra.flats[flat.id] || null }));
      const facings = new Map(snapshot.flats.filter(flat => flat.lightview).map(flat => [flat.lightview.living.facing, flat.lightview.living.facingZh]));
      [...facings].sort().forEach(([value, label]) => $('facing').add(new Option(label, value)));
    } catch (error) {
      $('lightview-filters').disabled = true;
      console.warn('Lightview分析未能載入；原有選樓資料仍可使用。', error);
    }
    $('snapshot-date').textContent = snapshot.asOf;
    snapshot.estates.forEach(e => $('estate').add(new Option(`${e.name} · ${e.district}（供選${e.initial}伙）`, e.name)));
    $('source-list').innerHTML = `<ul>${snapshot.sources.map(s => `<li><a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.label)} ↗</a></li>`).join('')}</ul>`;
    $('snapshot-note').textContent = snapshot.note;
    updateBlocks();
    ids.forEach(id => $(id).addEventListener(id === 'query' || $(id).type === 'number' ? 'input' : 'change', () => {
      if (id === 'estate') { $('block').value = ''; updateBlocks(); }
      page = 1; render();
    }));
    $('reset').addEventListener('click', reset);
    $('empty-reset').addEventListener('click', reset);
    $('previous').addEventListener('click', () => { page--; render(); });
    $('next').addEventListener('click', () => { page++; render(); });
    $('download').addEventListener('click', () => {
      const url = URL.createObjectURL(new Blob([toCsv(filtered)], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a'); a.href = url; a.download = `宏福苑選樓_${$('estate').value || '全部屋苑'}_${snapshot.asOf}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    render();
    showRefreshStatus();
  } catch (error) {
    $('error').hidden = false;
    $('error').textContent = '未能載入單位資料，請重新整理網頁，或到 GitHub 查看資料快照。';
    $('result-count').textContent = '資料暫時無法載入';
    console.error(error);
  }
}

const drawer = $('filter-drawer');
const mobile = window.matchMedia('(max-width: 650px)');
function releaseDrawer() {
  document.body.classList.remove('drawer-open');
  $('open-filters').setAttribute('aria-expanded', 'false');
}
function closeDrawer() {
  drawer.close();
  releaseDrawer();
}
function syncDrawer() {
  closeDrawer();
  drawer.setAttribute('role', mobile.matches ? 'dialog' : 'region');
  if (!mobile.matches) drawer.show();
}
drawer.addEventListener('close', () => { if (!drawer.matches(':modal')) releaseDrawer(); });
drawer.addEventListener('cancel', event => { event.preventDefault(); closeDrawer(); });
$('open-filters').addEventListener('click', () => {
  if (!mobile.matches || drawer.open) return;
  drawer.showModal();
  document.body.classList.add('drawer-open');
  $('open-filters').setAttribute('aria-expanded', 'true');
});
$('close-filters').addEventListener('click', closeDrawer);
$('apply-filters').addEventListener('click', closeDrawer);
drawer.addEventListener('click', event => {
  if (!mobile.matches || event.target !== drawer) return;
  const rect = drawer.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDrawer();
});
mobile.addEventListener('change', syncDrawer);
syncDrawer();
init();
