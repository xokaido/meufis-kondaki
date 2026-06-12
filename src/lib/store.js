import { writable } from 'svelte/store';

// Persisted writable store on the same mk: localStorage keys the old app
// used, so existing users keep their settings and reading positions.
const raw = {
  get(k, d) { try { const v = localStorage.getItem('mk:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('mk:' + k, JSON.stringify(v)); } catch {} },
};

export function persisted(key, initial) {
  const w = writable(raw.get(key, initial));
  w.subscribe((v) => raw.set(key, v));
  return w;
}

// jsdom has no matchMedia — guard so unit tests can import this module
let systemTheme = 'dark';
try { if (matchMedia('(prefers-color-scheme: light)').matches) systemTheme = 'light'; } catch { /* tests */ }

export const theme = persisted('theme', systemTheme);
export const fontScale = persisted('font', 1);
export const showRubrics = persisted('rubrics', true);
export const wakeWanted = persisted('wake', false);
export const speedIdx = persisted('speed', 1);
export const role = persisted('role', null);

// Reading positions: one key per text (old format), plus mk:last for the
// home screen's continue card.
export function getPos(id) { return raw.get('pos:' + id, 0); }
export function setPos(id, i) { raw.set('pos:' + id, i); setLast(id); }
export function getLast() { return raw.get('last', null); }
export function setLast(id) { raw.set('last', { id, ts: Date.now() }); }
