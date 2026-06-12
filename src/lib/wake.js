// Screen wake lock. `setWake` is the single entry point; re-acquires on
// visibility return (locks are auto-released when the tab hides).
let lock = null;
let want = false;

async function acquire() {
  if (!('wakeLock' in navigator)) return;
  try {
    lock = await navigator.wakeLock.request('screen');
    lock.addEventListener('release', () => { lock = null; });
  } catch { /* low battery etc. — fail quietly */ }
}

export function setWake(v) {
  want = v;
  if (v && !lock) acquire();
  if (!v && lock) { lock.release(); lock = null; }
}

document.addEventListener('visibilitychange', () => {
  if (want && document.visibilityState === 'visible' && !lock) acquire();
});
