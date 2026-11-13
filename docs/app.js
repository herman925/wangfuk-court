import { selectFlats, toCsv, STATUS_LABELS } from './model.js?v=20261113-drawers';
import { WISHLIST_KEY, decodeWishlist, wishlistText, parseWishlist } from './wishlist.js?v=20261113-drawers';

const $ = id => document.getElementById(id);
const ids = ['estate', 'status', 'block', 'minArea', 'maxArea', 'maxPrice', 'minFloor', 'maxFloor', 'facing', 'minWinterSun', 'minSky', 'minWater', 'wishlistOnly', 'query', 'sort'];
const integer = new Intl.NumberFormat('zh-HK');
const money = price => (price / 10000).toLocaleString('zh-HK', { maximumFractionDigits: 2 });
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let snapshot, filtered = [], page = 1;
let wishlist = new Set(), storageAvailable = true;
let toastTimer;
const pageSize = 50;

function showToast(message) {
  const toast = $('wishlist-feedback');
  clearTimeout(toastTimer);
  (document.querySelector('dialog:modal') || document.body).append(toast);
  toast.textContent = message;
  toast.classList.add('is-visible');
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 4000);
}

function filters() {
  return { ...Object.fromEntries(ids.map(id => [id, $(id).type === 'checkbox' ? $(id).checked : $(id).value])), wishlistIds: wishlist };
}

function storageWarning() {
  const message = '此瀏覽器未能讀取或保存清單；本次變更只留在此頁，請先複製備份。原有儲存不會被覆寫。';
  $('wishlist-storage-note').textContent = message;
  $('wishlist-warning').textContent = message;
  $('wishlist-warning').hidden = false;
}

function saveWishlist() {
  if (storageAvailable) {
    try { localStorage.setItem(WISHLIST_KEY, JSON.stringify({ version: 1, ids: [...wishlist] })); }
    catch { storageAvailable = false; }
  }
  if (!storageAvailable) storageWarning();
}

function previewImport() {
  try {
    const parsed = parseWishlist($('wishlist-import').value, snapshot.flats);
    const additions = parsed.ids.filter(id => !wishlist.has(id));
    $('import-wishlist').disabled = additions.length === 0;
    if (!$('wishlist-import').value.trim()) {
      $('import-preview').textContent = '只加入能與供選名單配對的單位；保留原有收藏，並採用網站目前的售價及揀選狀態。';
    } else {
      $('import-preview').textContent = parsed.ids.length || parsed.unmatched.length
        ? `可新增 ${additions.length} 伙；${parsed.ids.length - additions.length} 伙已在收藏；文字內重複 ${parsed.duplicates} 次；${parsed.unmatched.length} 列未能配對，不會加入。`
        : '未找到單位。請貼上分享清單，並保留【屋苑｜座數｜樓層｜單位】的完整一行。';
    }
    return additions;
  } catch (error) {
    $('import-preview').textContent = error.message;
    $('import-wishlist').disabled = true;
    return [];
  }
}

function renderWishlist() {
  const byId = new Map(snapshot.flats.map(flat => [flat.id, flat]));
  const rows = [...wishlist].map(id => byId.get(id)).filter(Boolean);
  const text = wishlistText(rows);
  $('wishlist-count').textContent = `${integer.format(rows.length)}伙`;
  $('mobile-wishlist-count').textContent = integer.format(rows.length);
  $('wishlist-drawer-count').textContent = `${integer.format(rows.length)}伙收藏`;
  $('view-wishlist').disabled = !rows.length;
  $('wishlist-share').value = text;
  $('copy-wishlist').disabled = !rows.length;
  // shortcut: long WhatsApp hand-off URLs vary by browser; use the complete copyable text above 8,000 encoded characters.
  const tooLong = encodeURIComponent(text).length > 8000;
  $('whatsapp-wishlist').disabled = !rows.length || tooLong;
  $('share-feedback').textContent = tooLong ? '清單較長，請按「複製清單」，再貼到WhatsApp；內容不會截短。' : '';
  previewImport();
}

function setupWishlist() {
  try { wishlist = decodeWishlist(localStorage.getItem(WISHLIST_KEY), snapshot.flats); }
  catch { storageAvailable = false; storageWarning(); }
  $('flat-rows').addEventListener('click', event => {
    const button = event.target.closest('[data-wishlist-id]');
    if (!button) return;
    const id = button.dataset.wishlistId;
    const added = !wishlist.has(id);
    if (added) wishlist.add(id); else wishlist.delete(id);
    saveWishlist(); render();
    showToast(added ? '已納入心許之所，可與家人分享這份心意。' : '已從心許之所移除。');
    $('results-heading').tabIndex = -1;
    (document.querySelector(`[data-wishlist-id="${CSS.escape(id)}"]`) || $('results-heading')).focus({ preventScroll: true });
  });
  $('wishlist-import').addEventListener('input', previewImport);
  $('import-wishlist').addEventListener('click', () => {
    const additions = previewImport();
    if (!additions.length) return;
    additions.forEach(id => wishlist.add(id));
    saveWishlist(); render();
    showToast(`已加入 ${additions.length} 伙心許之所，原有收藏已保留。`);
  });
  $('copy-wishlist').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('wishlist-share').value);
      $('share-feedback').textContent = '已複製整份清單，可貼到WhatsApp分享，或留作備份。';
    } catch {
      $('wishlist-share').focus(); $('wishlist-share').select();
      $('share-feedback').textContent = '未能自動複製，已選取整份清單；請長按或按Ctrl+C複製。';
    }
  });
  $('whatsapp-wishlist').addEventListener('click', () => {
    window.open(`https://wa.me/?text=${encodeURIComponent($('wishlist-share').value)}`, '_blank', 'noopener,noreferrer');
    $('share-feedback').textContent = '請在WhatsApp選擇收件人，確認後傳送。';
  });
  window.addEventListener('storage', event => {
    if (event.key !== WISHLIST_KEY && event.key !== null) return;
    try { wishlist = decodeWishlist(event.key === null ? null : event.newValue, snapshot.flats); render(); }
    catch { storageAvailable = false; storageWarning(); }
  });
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
  renderWishlist();
  const f = filters();
  filtered = selectFlats(snapshot.flats, f);
  const estate = snapshot.estates.find(e => e.name === f.estate);
  $('results-heading').textContent = f.wishlistOnly ? `${estate ? estate.name + ' · ' : ''}心許之所` : estate ? estate.name : '全部屋苑';
  $('estate-note').textContent = estate ? `${estate.district} · 特設供選 ${estate.initial} 伙 · 未揀選 ${estate.available} 伙` : `10個項目 · 特設供選範圍 ${integer.format(snapshot.initialCount)} 伙`;
  $('result-count').textContent = `找到 ${integer.format(filtered.length)} 伙符合條件的單位`;
  $('mobile-count').textContent = integer.format(filtered.length);
  $('apply-filters').textContent = `顯示 ${integer.format(filtered.length)} 伙結果`;
  $('status-counts').innerHTML = Object.entries(STATUS_LABELS).map(([state, label]) => `<span class="status ${state}">${label} ${integer.format(filtered.filter(row => row.status === state).length)} 伙</span>`).join('');
  $('analysis-coverage').textContent = `目前篩選結果中，${integer.format(filtered.filter(row => row.lightview).length)} 伙有可配對的 Lightview 日照及景觀模擬；缺少或面積不符的資料不套用。`;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  page = Math.min(page, pages);
  const start = (page - 1) * pageSize;
  $('flat-rows').innerHTML = filtered.slice(start, start + pageSize).map(row => `<tr role="row"><td role="cell"><div class="flat-heading"><strong>${escape(row.estate)}</strong><button type="button" class="wish-button" data-wishlist-id="${escape(row.id)}" aria-pressed="${wishlist.has(row.id)}" aria-label="${wishlist.has(row.id) ? '移除' : '加入'}心許之所：${escape(row.estate)} ${row.block === '-' ? '不分座' : escape(row.block) + '座'} ${row.floor}樓 ${escape(row.unit)}室">${wishlist.has(row.id) ? '♥' : '♡'}</button></div><small>${row.block === '-' ? '不分座' : `${escape(row.block)}座`}</small></td><td role="cell">${row.floor}樓 <strong>${escape(row.unit)}室</strong></td><td role="cell" class="numeric" data-label="實用面積"><strong>${row.sqft}</strong> 呎<small>${row.sqm} 平方米</small></td><td role="cell" class="numeric" data-label="價單售價（港元）"><strong>$${integer.format(row.price)}</strong><small>約 ${money(row.price)} 萬</small></td><td role="cell" class="status-cell"><span class="status ${row.status}">${STATUS_LABELS[row.status]}</span><small>${row.source === 'official' ? `官方${escape(row.sourceStatus)}` : '使用者提供PDF'} · ${escape(row.asOf)}</small></td><td role="cell" class="analysis-cell">${analysisCell(row)}</td></tr>`).join('');
  $('empty').hidden = filtered.length !== 0;
  $('empty-note').textContent = f.wishlistOnly && !wishlist.size
    ? '尚未收藏單位。按「重設篩選」返回名單，再按單位旁的「♡」；亦可匯入家人分享的清單。'
    : '試試提高預算、放寬面積或樓層，或按「重設」重新選擇。';
  $('page-info').textContent = filtered.length ? `${start + 1}–${Math.min(start + pageSize, filtered.length)} / ${integer.format(filtered.length)} 伙 · 第 ${page} / ${pages} 頁` : '0 伙';
  $('previous').disabled = page === 1;
  $('next').disabled = page === pages;
  $('download').disabled = filtered.length === 0;
}

function reset() {
  ids.forEach(id => { if ($(id).type === 'checkbox') $(id).checked = false; else $(id).value = id === 'sort' ? 'price-asc' : ''; });
  updateBlocks(); page = 1; render();
}

async function showRefreshStatus() {
  try {
    const response = await fetch('./data/update-status.json', { cache: 'no-cache' });
    if (!response.ok) return;
    const status = await response.json();
    const labels = { selection: '官方揀選狀態', lightview: 'Lightview', sierra: '樂嶺軒公告' };
    const time = date => date ? new Date(date).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', hour12: false }) : '未有成功記錄';
    $('refresh-note').textContent = `每日香港時間00:00自動檢查。${Object.entries(labels).map(([key, label]) => {
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
    setupWishlist();
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
const wishlistDrawer = $('wishlist-drawer');
const mobile = window.matchMedia('(max-width: 650px)');
function releaseDrawer() {
  document.body.classList.toggle('drawer-open', Boolean(document.querySelector('dialog:modal')));
  $('open-filters').setAttribute('aria-expanded', 'false');
}
function closeDrawer() {
  drawer.close();
  releaseDrawer();
}
function syncDrawer() {
  closeDrawer();
  closeWishlist();
  drawer.setAttribute('role', mobile.matches ? 'dialog' : 'region');
  if (!mobile.matches) drawer.show();
}
drawer.addEventListener('close', () => { if (!drawer.matches(':modal')) releaseDrawer(); });
drawer.addEventListener('cancel', event => { event.preventDefault(); closeDrawer(); });
$('open-filters').addEventListener('click', () => {
  if (!mobile.matches || drawer.open) return;
  closeWishlist();
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

function releaseWishlist() {
  document.body.classList.toggle('drawer-open', Boolean(document.querySelector('dialog:modal')));
  ['open-wishlist', 'open-wishlist-mobile'].forEach(id => $(id).setAttribute('aria-expanded', 'false'));
  if (wishlistDrawer.contains($('wishlist-feedback'))) document.body.append($('wishlist-feedback'));
}
function closeWishlist() {
  wishlistDrawer.close();
  releaseWishlist();
}
['open-wishlist', 'open-wishlist-mobile'].forEach(id => $(id).addEventListener('click', () => {
  if (wishlistDrawer.open) return;
  if (drawer.matches(':modal')) closeDrawer();
  wishlistDrawer.showModal();
  document.body.classList.add('drawer-open');
  ['open-wishlist', 'open-wishlist-mobile'].forEach(trigger => $(trigger).setAttribute('aria-expanded', 'true'));
}));
$('close-wishlist').addEventListener('click', closeWishlist);
wishlistDrawer.addEventListener('close', () => { if (!wishlistDrawer.open) releaseWishlist(); });
wishlistDrawer.addEventListener('cancel', event => { event.preventDefault(); closeWishlist(); });
wishlistDrawer.addEventListener('click', event => {
  if (event.target !== wishlistDrawer) return;
  const rect = wishlistDrawer.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeWishlist();
});
$('view-wishlist').addEventListener('click', () => {
  reset();
  $('wishlistOnly').checked = true;
  render();
  closeWishlist();
  $('results').scrollIntoView({ block: 'start' });
});
mobile.addEventListener('change', syncDrawer);
syncDrawer();
init();
