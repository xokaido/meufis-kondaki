// Constant-rate auto-scroll engine for a scroll container. Owns its rAF
// loop; reports running-state changes through onState so component state
// (button icon, wake policy) stays in the component.
export function createAutoScroll({ el, speed, onState }) {
  let raf = 0, last = 0, pos = 0, running = false;

  function stop() {
    if (!running) return;
    cancelAnimationFrame(raf);
    running = false;
    onState(false);
  }

  function tick(now) {
    const s = el();
    if (!running || !s || !s.isConnected) { stop(); return; }
    const max = s.scrollHeight - s.clientHeight;
    pos = Math.min(pos + speed() * (now - last) / 1000, max);
    last = now;
    s.scrollTop = pos;
    if (pos >= max) { stop(); return; }
    raf = requestAnimationFrame(tick);
  }

  function start() {
    const s = el();
    if (running || !s) return;
    running = true;
    last = performance.now();
    pos = s.scrollTop;
    onState(true);
    raf = requestAnimationFrame(tick);
  }

  return { start, stop, get running() { return running; } };
}
