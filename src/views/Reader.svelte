<script>
  import { loadIndex, loadText } from '../lib/data.js';
  import { getPos, setPos, theme, wakeWanted, speedIdx, role } from '../lib/store.js';
  import { setWake } from '../lib/wake.js';
  import { groupBlocks } from '../lib/blocks.js';
  import { roleMarks } from '../lib/roles.js';
  import Block from '../components/Block.svelte';
  import TocSheet from '../components/TocSheet.svelte';
  import RoleSheet from '../components/RoleSheet.svelte';
  import FollowBar from '../components/FollowBar.svelte';

  let { id, block = null } = $props();

  let data = $state(null);
  let failed = $state(false);
  let meta = $state(null);
  let next = $state(null);

  let scroller;            // the inner scroll container (NOT window — see below)
  let appEl;               // root for swipe-back transform
  let sheetOpen = $state(false);
  let roleSheetOpen = $state(false);
  let follow = $state(false);
  let progress = $state(0);
  let currentI = $state(0);
  let fabDir = $state('down');
  let fabHidden = $state(true);
  let auto = null;
  let autoOn = $state(false);
  let scrollTimer = null;
  let restoreCancelled = false;

  const NEXT = { vespers: 'matins', matins: 'liturgy' };
  const SPEEDS = [18, 32, 50, 75, 110]; // px per second
  const SPEED_LABELS = ['½×', '1×', '1½×', '2×', '3×'];

  const items = $derived(data ? groupBlocks(data.blocks) : []);
  const marks = $derived(data ? roleMarks(data.blocks, $role) : { mine: new Set(), cue: new Set() });
  const dropcaps = $derived.by(() => {
    const s = new Set();
    if (!data) return s;
    data.blocks.forEach((b, i) => {
      if (i > 0 && data.blocks[i - 1].t === 'head' && ['say', 'prayer', 'text'].includes(b.t)) s.add(i);
    });
    return s;
  });
  const section = $derived.by(() => {
    if (!data) return null;
    let cur = data.toc[0];
    for (const t of data.toc) { if (t.i <= currentI) cur = t; else break; }
    return cur;
  });
  const sectionIdx = $derived(data && section ? data.toc.findIndex((t) => t.i === section.i) : 0);

  $effect(() => {
    document.title = (meta ? meta.name + ' · ' : '') + 'მეუფის კონდაკი';
  });

  // App remounts this view whenever id/block change, so reading `id` once
  // at init is intentional — it can never go stale within a mount.
  // svelte-ignore state_referenced_locally
  Promise.all([loadIndex(), loadText(id)]).then(([idx, d]) => {
    meta = idx.texts.find((t) => t.id === id) || null;
    next = NEXT[id] ? idx.texts.find((t) => t.id === NEXT[id]) : null;
    data = d;
  }).catch(() => { failed = true; });

  // ── scroll mechanics, ported from the old app ──
  // The reader scrolls inside .scrollwrap, not the window: browsers re-apply
  // window scroll positions on hash navigation (Safari asynchronously), but
  // they never touch an inner element's scrollTop.
  function blockEls() { return Array.from(scroller.querySelectorAll('[data-i]')); }

  // A block can be invisible (hidden rubric, collapsed group): fall forward
  // to the nearest block that has layout so jumps never use an empty rect.
  function jumpTarget(i) {
    const exact = scroller.querySelector(`[data-i="${i}"]`);
    if (exact) {
      const grp = exact.closest('details.pgroup');
      if (grp && !grp.open) grp.open = true;
      if (exact.getClientRects().length) return exact;
    }
    for (const el of blockEls()) {
      if (+el.dataset.i >= i && el.getClientRects().length) return el;
    }
    return exact;
  }

  function topBlockIndex() {
    const probe = 90;
    let lo = 0;
    for (const el of blockEls()) {
      if (el.getBoundingClientRect().bottom > probe) return +el.dataset.i;
      lo = +el.dataset.i;
    }
    return lo;
  }

  function goBlock(i, smooth = false) {
    const el = jumpTarget(i);
    if (!el) return;
    restoreCancelled = true;
    stopAuto();
    const y = Math.max(0, el.getBoundingClientRect().top + scroller.scrollTop - 86);
    scroller.scrollTo({ top: y, behavior: smooth ? 'smooth' : 'auto' });
  }

  function onScroll() {
    // iOS momentum can fire scroll events after teardown; a detached
    // scroller has all-zero rects which would corrupt the saved position.
    if (!scroller || !scroller.isConnected || scroller.clientHeight === 0) return;
    const max = scroller.scrollHeight - scroller.clientHeight;
    progress = max > 0 ? (scroller.scrollTop / max) * 100 : 0;
    currentI = topBlockIndex();
    fabHidden = max < scroller.clientHeight;
    fabDir = scroller.scrollTop < scroller.clientHeight * 1.5 ? 'down' : 'up';
    clearTimeout(scrollTimer);
    const i = currentI;
    scrollTimer = setTimeout(() => { if (scroller && scroller.isConnected) setPos(id, i); }, 400);
  }

  function fabClick() {
    restoreCancelled = true;
    stopAuto();
    scroller.scrollTo({ top: fabDir === 'down' ? scroller.scrollHeight - scroller.clientHeight : 0, behavior: 'smooth' });
  }

  // ── auto-scroll ──
  function stopAuto() {
    if (!auto) return;
    cancelAnimationFrame(auto.raf);
    auto = null;
    autoOn = false;
    if (!$wakeWanted && !follow) setWake(false);
  }
  function startAuto() {
    if (auto) return;
    restoreCancelled = true;
    auto = { last: performance.now(), pos: scroller.scrollTop };
    autoOn = true;
    setWake(true); // hands-free reading keeps the screen on
    const tick = (now) => {
      if (!auto || !scroller.isConnected) { stopAuto(); return; }
      auto.pos = Math.min(auto.pos + SPEEDS[$speedIdx] * (now - auto.last) / 1000,
        scroller.scrollHeight - scroller.clientHeight);
      auto.last = now;
      scroller.scrollTop = auto.pos;
      if (auto.pos >= scroller.scrollHeight - scroller.clientHeight) { stopAuto(); return; }
      auto.raf = requestAnimationFrame(tick);
    };
    auto.raf = requestAnimationFrame(tick);
  }
  function bumpSpeed(d) { speedIdx.update((s) => Math.min(SPEEDS.length - 1, Math.max(0, s + d))); }

  // ── follow mode ──
  function enterFollow() { follow = true; setWake(true); }
  function exitFollow() { follow = false; stopAuto(); if (!$wakeWanted) setWake(false); }
  function goSection(d) {
    if (!data) return;
    const target = Math.min(data.toc.length - 1, Math.max(0, sectionIdx + d));
    goBlock(data.toc[target].i);
  }

  // ── position restore + swipe back: attached once data renders ──
  $effect(() => {
    if (!data || !scroller) return;
    scroller.addEventListener('scroll', onScroll, { passive: true });
    ['touchstart', 'wheel'].forEach((ev) => scroller.addEventListener(ev, stopAuto, { passive: true }));

    // restore: deep-link block param wins over the saved position
    const target = block != null ? block : getPos(id);
    const savedEl = target > 2 || block != null ? jumpTarget(target) : null;
    if (savedEl) {
      const targetY = () => Math.max(0, savedEl.getBoundingClientRect().top + scroller.scrollTop - 86);
      scroller.scrollTop = targetY();
      if (block != null) {
        savedEl.classList.add('flash');
        setTimeout(() => savedEl.classList.remove('flash'), 2000);
      }
      let userTookOver = false;
      const stop = () => { userTookOver = true; };
      ['wheel', 'touchstart', 'keydown'].forEach((ev) =>
        scroller.addEventListener(ev, stop, { once: true, passive: true }));
      // brief corrector: re-assert the anchor if late layout (fonts) or a
      // WebKit clamp moved it; recomputed from the element so it converges
      const t0 = performance.now();
      (function watch() {
        if (userTookOver || restoreCancelled || !scroller.isConnected || performance.now() - t0 > 1200) return;
        const y = targetY();
        if (Math.abs(scroller.scrollTop - y) > 48) scroller.scrollTop = y;
        requestAnimationFrame(watch);
      })();
      if (document.fonts?.ready) {
        document.fonts.ready.then(() => {
          if (!userTookOver && !restoreCancelled && scroller.isConnected) scroller.scrollTop = targetY();
        });
      }
    }
    onScroll();
    if ($wakeWanted) setWake(true);

    // Swipe right anywhere to go home (Telegram-style back gesture); the
    // view follows the finger, releasing past a third (or a quick flick)
    // navigates back. Direction lock keeps vertical scrolling unaffected.
    let sx = 0, sy = 0, t0g = 0, tracking = false, lockedH = false;
    const reset = (animate) => {
      if (animate) {
        appEl.style.transition = 'transform .22s ease';
        appEl.style.transform = 'translateX(0)';
        setTimeout(() => { if (appEl) appEl.style.transition = ''; }, 240);
      } else {
        appEl.style.transition = '';
        appEl.style.transform = '';
      }
      tracking = lockedH = false;
    };
    const ts = (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      sx = t.clientX; sy = t.clientY; t0g = performance.now();
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
      appEl.style.transition = 'none';
      appEl.style.transform = `translateX(${Math.max(0, dx)}px)`;
    };
    const te = (e) => {
      if (!tracking) return;
      const dx = e.changedTouches[0].clientX - sx;
      const vx = dx / Math.max(1, performance.now() - t0g);
      if (lockedH && (dx > innerWidth * 0.32 || (dx > 60 && vx > 0.45))) {
        appEl.style.transition = 'transform .2s ease-out';
        appEl.style.transform = 'translateX(100%)';
        setTimeout(() => { location.hash = ''; }, 200);
        tracking = lockedH = false;
      } else reset(lockedH);
    };
    const tc = () => reset(true);
    scroller.addEventListener('touchstart', ts, { passive: true });
    scroller.addEventListener('touchmove', tm, { passive: true });
    scroller.addEventListener('touchend', te, { passive: true });
    scroller.addEventListener('touchcancel', tc, { passive: true });

    return () => {
      clearTimeout(scrollTimer);
      stopAuto();
      if (!$wakeWanted) setWake(false);
    };
  });
</script>

<div class="view" class:follow bind:this={appEl}>
  <div class="progress"><i style="width:{progress}%"></i></div>

  {#if !follow}
    <header class="topbar">
      <button class="back" onclick={() => { location.hash = ''; }} aria-label="უკან">‹</button>
      <div class="titles">
        <div class="t-name">{meta ? meta.name : ''}</div>
        <div class="t-sec">{section ? section.text : ''}</div>
      </div>
      <button class="tb" class:on={autoOn} onclick={() => (autoOn ? stopAuto() : startAuto())} aria-label="ავტო-გადახვევა">{autoOn ? '⏸︎' : '▶︎'}</button>
      <button class="tb" onclick={enterFollow} aria-label="თვალყურის დევნება">👁︎</button>
      <button class="tb" onclick={() => theme.update((t) => (t === 'light' ? 'dark' : 'light'))} aria-label="თემა">{$theme === 'light' ? '☾' : '☀'}</button>
      <button class="tb" onclick={() => { sheetOpen = true; }} aria-label="სარჩევი">☰</button>
    </header>
  {:else}
    <header class="follow-top">
      <button class="exit" onclick={exitFollow}>✕ დასრულება</button>
      <span class="wake-dot" title="ეკრანი არ ჩაქრება">●</span>
    </header>
  {/if}

  {#if autoOn}
    <div class="speed-pill">
      <button onclick={() => bumpSpeed(-1)} aria-label="ნელა">−</button>
      <span>{SPEED_LABELS[$speedIdx]}</span>
      <button onclick={() => bumpSpeed(1)} aria-label="სწრაფად">+</button>
    </div>
  {/if}

  <div class="scrollwrap" bind:this={scroller} tabindex="-1">
    {#if failed}
      <div class="err"><p>ვერ ჩაიტვირთა — შეამოწმეთ კავშირი</p>
        <button onclick={() => location.reload()}>განახლება</button></div>
    {:else if data}
      <main class="reader">
        {#each items as item (item.i)}
          {#if item.group}
            <details class="pgroup" open>
              <summary><h2 class="ghead" data-i={item.i}>{item.head.text}<span class="tog">▾</span></h2></summary>
              {#each item.blocks as b, k (item.start + k)}
                <Block block={b} i={item.start + k}
                  mine={marks.mine.has(item.start + k)} cue={marks.cue.has(item.start + k)}
                  dropcap={dropcaps.has(item.start + k)} />
              {/each}
            </details>
          {:else}
            <Block block={item.block} i={item.i}
              mine={marks.mine.has(item.i)} cue={marks.cue.has(item.i)}
              dropcap={dropcaps.has(item.i)} />
          {/if}
        {/each}
        <div class="fin">☩</div>
        {#if next}
          <a class="next-svc" href="#/t/{next.id}">
            <span class="nx-label">შემდეგი მსახურება</span>
            <span class="nx-row"><span class="nx-name">{next.name}</span><span aria-hidden="true">›</span></span>
          </a>
        {/if}
      </main>
    {/if}
  </div>

  {#if !follow}
    <button class="fab" hidden={fabHidden} onclick={fabClick} aria-label={fabDir === 'down' ? 'ბოლოში' : 'თავიდან'}>
      {fabDir === 'down' ? '↓' : '↑'}
    </button>
  {:else if data}
    <FollowBar
      sectionName={section ? section.text : ''}
      pos={sectionIdx + 1} total={data.toc.length}
      onPrev={() => goSection(-1)} onNext={() => goSection(1)} />
  {/if}

  {#if sheetOpen && data}
    <TocSheet toc={data.toc} {currentI}
      onGo={(i) => { sheetOpen = false; goBlock(i); }}
      onClose={() => { sheetOpen = false; }}
      onPickRole={() => { sheetOpen = false; roleSheetOpen = true; }} />
  {/if}
  {#if roleSheetOpen}
    <RoleSheet onClose={() => { roleSheetOpen = false; }} />
  {/if}
</div>

<style>
  .view { position: fixed; inset: 0; display: flex; flex-direction: column; background: var(--bg); }
  .progress { position: absolute; top: 0; left: 0; right: 0; height: 3px; z-index: 30; background: transparent; }
  .progress i { display: block; height: 3px; background: var(--accent); }
  .topbar, .follow-top { display: flex; align-items: center; gap: 4px; padding: calc(6px + env(safe-area-inset-top)) 8px 6px; border-bottom: 1px solid var(--line); background: var(--bg); }
  .back { font-size: 26px; padding: 0 10px 4px; color: var(--muted); }
  .titles { flex: 1; min-width: 0; }
  .t-name { font-size: 14.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .t-sec { font-size: 11px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tb { padding: 6px 9px; font-size: 15px; color: var(--muted); }
  .tb.on { color: var(--accent); }
  .follow-top { justify-content: space-between; padding-left: 14px; padding-right: 14px; }
  .exit { border: 1px solid var(--line); border-radius: 99px; padding: 4px 12px; font-size: 12.5px; color: var(--muted); }
  .wake-dot { color: var(--accent); font-size: 10px; }
  .speed-pill { position: absolute; top: calc(54px + env(safe-area-inset-top)); right: 12px; z-index: 31; display: flex; align-items: center; gap: 2px; background: var(--bg-sheet); border: 1px solid var(--line); border-radius: 99px; box-shadow: var(--shadow); }
  .speed-pill button { padding: 5px 12px; font-size: 16px; }
  .speed-pill span { font-size: 12px; min-width: 28px; text-align: center; }
  .scrollwrap { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }
  .reader { max-width: 560px; margin: 0 auto; padding: 18px 18px 40px; }
  .view.follow .reader { font-size: 1.1em; }
  .pgroup summary { list-style: none; cursor: pointer; }
  .pgroup summary::-webkit-details-marker { display: none; }
  .ghead { color: var(--accent); font-size: calc(15px * var(--fs)); letter-spacing: .06em; margin: calc(26px * var(--fs)) 0 calc(12px * var(--fs)); text-align: center; }
  .ghead .tog { margin-left: 8px; font-size: 11px; color: var(--muted); }
  .pgroup:not([open]) .ghead .tog { transform: rotate(-90deg); display: inline-block; }
  .fin { text-align: center; color: var(--accent); font-size: 24px; margin: 36px 0 8px; }
  .next-svc { display: block; text-decoration: none; color: inherit; background: var(--bg-sheet); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; margin-top: 14px; }
  .nx-label { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--accent); font-weight: 700; }
  .nx-row { display: flex; justify-content: space-between; font-weight: 600; }
  .fab { position: absolute; right: 14px; bottom: calc(18px + env(safe-area-inset-bottom)); width: 42px; height: 42px; border-radius: 50%; background: var(--bg-sheet); border: 1px solid var(--line); box-shadow: var(--shadow); z-index: 31; }
  .err { text-align: center; padding: 60px 20px; color: var(--muted); }
  :global(.flash) { animation: flash 2s ease-out; }
  @keyframes flash { 0%, 40% { background: var(--accent-soft); } 100% { background: transparent; } }
</style>
