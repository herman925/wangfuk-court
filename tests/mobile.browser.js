// Run this expression in the loaded site's browser at a width of 650px or less.
(async () => {
  const el = id => document.getElementById(id);
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const tick = () => new Promise(resolve => setTimeout(resolve, 50));
  check(innerWidth <= 650, 'Use a mobile viewport');
  const opener = el('open-filters'), drawer = el('filter-drawer');
  check(!drawer.open, 'Filters should start closed on mobile');
  opener.focus(); opener.click();
  check(drawer.matches(':modal'), 'Drawer should isolate the background');
  check(drawer.contains(document.activeElement), 'Focus should move into drawer');
  el('query').focus();
  check(drawer.contains(document.activeElement), 'Background must not take focus');
  el('estate').value = '啟陽苑';
  el('estate').dispatchEvent(new Event('change'));
  check(el('apply-filters').textContent.includes('314'), 'Filtered count should update');
  el('apply-filters').click(); await tick();
  check(!drawer.open && !document.body.classList.contains('drawer-open'), 'Apply must close and unlock');
  check(document.activeElement === opener, 'Focus should return to trigger');
  check(el('stat-count').textContent === '314', 'Closing must retain filters');
  opener.click();
  el('minArea').value = '900'; el('minArea').dispatchEvent(new Event('input'));
  check(el('apply-filters').textContent.includes('0'), 'Empty results should update count');
  el('reset').click();
  check(el('stat-count').textContent === '3,125', 'Reset should restore complete snapshot');
  el('close-filters').click(); await tick();
  check(!drawer.open && opener.getAttribute('aria-expanded') === 'false', 'Close must reset trigger state');
  check(document.documentElement.scrollWidth <= innerWidth, 'Mobile page must not overflow horizontally');
  check(document.querySelector('table').scrollWidth <= innerWidth, 'Mobile flats must fit viewport');
  return 'Mobile drawer, focus isolation/return, filtering, empty state, reset and layout passed';
})()
