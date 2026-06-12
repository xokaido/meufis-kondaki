import { writable } from 'svelte/store';

// Screen wake lock. `setWake` is the single entry point; re-acquires on
// visibility return (locks are auto-released when the tab hides).
// wakeStatus reflects the ACTUAL lock state — not the desired state — so the
// UI never claims the screen is kept awake when the browser said no:
//   'off' | 'active' | 'failed' | 'unsupported'
export const wakeStatus = writable('off');

let lock = null;
let want = false;

async function acquire() {
  if (!('wakeLock' in navigator)) { wakeStatus.set('unsupported'); return; }
  try {
    lock = await navigator.wakeLock.request('screen');
    wakeStatus.set('active');
    lock.addEventListener('release', () => {
      lock = null;
      // hidden-tab release: visibilitychange below re-acquires if still wanted
      wakeStatus.set('off');
    });
  } catch {
    wakeStatus.set('failed'); // low battery, permissions policy, …
  }
}

export function setWake(v) {
  want = v;
  if (v && !lock) acquire();
  if (!v) {
    if (lock) { lock.release(); lock = null; }
    wakeStatus.set('off');
  }
}

document.addEventListener('visibilitychange', () => {
  if (want && document.visibilityState === 'visible' && !lock) acquire();
});
