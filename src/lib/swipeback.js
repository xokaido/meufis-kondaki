// Svelte action: Telegram-style swipe-right-to-go-back, ported intact from
// the old app. Attach to the scroll container; `target()` is the element
// that follows the finger; `onBack` fires once the gesture commits.
// Releasing past a third of the screen (or a quick flick) commits; a
// direction lock keeps vertical scrolling unaffected.
export function swipeback(node, { target, onBack }) {
  let sx = 0, sy = 0, t0 = 0, tracking = false, lockedH = false;

  const reset = (animate) => {
    const el = target();
    if (el) {
      if (animate) {
        el.style.transition = 'transform .22s ease';
        el.style.transform = 'translateX(0)';
        setTimeout(() => { if (el.isConnected) el.style.transition = ''; }, 240);
      } else {
        el.style.transition = '';
        el.style.transform = '';
      }
    }
    tracking = lockedH = false;
  };

  const ts = (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    sx = t.clientX; sy = t.clientY; t0 = performance.now();
    tracking = true; lockedH = false;
  };

  const tm = (e) => {
    if (!tracking) return;
    const t = e.touches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (!lockedH) {
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
      if (dx > Math.abs(dy) * 1.4) lockedH = true;
      else { tracking = false; return; }
    }
    const el = target();
    if (!el) return;
    el.style.transition = 'none';
    el.style.transform = `translateX(${Math.max(0, dx)}px)`;
  };

  const te = (e) => {
    if (!tracking) return;
    const dx = e.changedTouches[0].clientX - sx;
    const vx = dx / Math.max(1, performance.now() - t0);
    if (lockedH && (dx > innerWidth * 0.32 || (dx > 60 && vx > 0.45))) {
      const el = target();
      if (el) {
        el.style.transition = 'transform .2s ease-out';
        el.style.transform = 'translateX(100%)';
      }
      setTimeout(onBack, 200);
      tracking = lockedH = false;
    } else reset(lockedH);
  };

  const tc = () => reset(true);

  node.addEventListener('touchstart', ts, { passive: true });
  node.addEventListener('touchmove', tm, { passive: true });
  node.addEventListener('touchend', te, { passive: true });
  node.addEventListener('touchcancel', tc, { passive: true });

  return {
    destroy() {
      node.removeEventListener('touchstart', ts);
      node.removeEventListener('touchmove', tm);
      node.removeEventListener('touchend', te);
      node.removeEventListener('touchcancel', tc);
    },
  };
}
