// Android/Chrome: real one-tap install via beforeinstallprompt.
// iOS: no install API exists — caller shows a two-step visual guide.
let installEvent = null;
const listeners = new Set();

export const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const isIOS = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
  listeners.forEach((fn) => fn(true));
});
addEventListener('appinstalled', () => {
  installEvent = null;
  listeners.forEach((fn) => fn(false));
});

export function onInstallable(fn) {
  listeners.add(fn);
  fn(!!installEvent);
  return () => listeners.delete(fn);
}

// Returns true if a native prompt was shown; false → caller shows iOS guide.
export function promptInstall() {
  if (!installEvent) return false;
  installEvent.prompt();
  return true;
}
