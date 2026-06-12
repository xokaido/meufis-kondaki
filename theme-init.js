// Runs before the stylesheet paints: apply the saved (or system) theme so
// dark-theme users never see a parchment flash. External file (not inline)
// so a strict script-src 'self' CSP holds.
try {
  var stored = null;
  try { stored = JSON.parse(localStorage.getItem('mk:theme')); } catch (e) {}
  var theme = stored === 'light' || stored === 'dark'
    ? stored
    : (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.documentElement.dataset.theme = theme;
  var mc = document.querySelector('meta[name=theme-color]');
  if (mc) mc.content = theme === 'light' ? '#f6efdd' : '#191310';
} catch (e) { /* default CSS still renders */ }
