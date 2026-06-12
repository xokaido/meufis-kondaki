import { writable } from 'svelte/store';

// App-update state (prompt-mode service worker). When a new version is
// waiting, needRefresh flips true; the home screen shows a chip whose tap
// applies it (skipWaiting → reload). If never tapped, the update applies on
// the next full app restart — it just never interrupts a live service.
export const needRefresh = writable(false);

let updater = null;
export function setUpdater(fn) { updater = fn; }
export function applyUpdate() { if (updater) updater(true); }
