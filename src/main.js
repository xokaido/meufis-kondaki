import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import { needRefresh, setUpdater } from './lib/update.js';
import './styles/tokens.css';
import './styles/global.css';
import App from './App.svelte';

// The old hand-rolled SW used kondaki-* cache names; Workbox won't clean
// those. Delete them once so upgrading users don't carry dead caches.
if ('caches' in window) {
  caches.keys().then((keys) =>
    keys.filter((k) => k.startsWith('kondaki-')).forEach((k) => caches.delete(k)));
}

setUpdater(registerSW({
  immediate: true,
  onNeedRefresh() { needRefresh.set(true); },
}));

mount(App, { target: document.getElementById('app') });
