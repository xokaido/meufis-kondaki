/* მეუფის კონდაკი — reader logic */
(function () {
  'use strict';

  const app = document.getElementById('app');
  const store = {
    get(k, d) { try { const v = localStorage.getItem('mk:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('mk:' + k, JSON.stringify(v)); } catch {} },
  };

  // ── settings ──
  let fontScale = store.get('font', 1);
  let theme = store.get('theme', 'dark');
  let showRubrics = store.get('rubrics', true);
  let wakeLock = null;
  let wakeWanted = store.get('wake', false);

  function applySettings() {
    document.documentElement.style.setProperty('--fs', fontScale);
    document.documentElement.dataset.theme = theme;
    document.body.classList.toggle('hide-rubrics', !showRubrics);
    const mc = document.querySelector('meta[name=theme-color]');
    if (mc) mc.content = theme === 'light' ? '#f3ead6' : '#161210';
  }

  async function acquireWake() {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch { wakeWanted = false; }
  }
  function releaseWake() { if (wakeLock) { wakeLock.release(); wakeLock = null; } }
  document.addEventListener('visibilitychange', () => {
    if (wakeWanted && document.visibilityState === 'visible' && !wakeLock) acquireWake();
  });

  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // ── routing ──
  let activeScrollHandler = null;
  function route() {
    if (activeScrollHandler) {
      window.removeEventListener('scroll', activeScrollHandler);
      activeScrollHandler = null;
    }
    document.body.classList.remove('sheet-open');
    const id = location.hash.replace(/^#\/?/, '');
    const svc = window.SERVICES.find((s) => s.id === id);
    if (svc) renderReader(svc); else renderHome();
    applySettings();
  }
  window.addEventListener('hashchange', route);

  // ── home ──
  function renderHome() {
    document.title = 'მეუფის კონდაკი';
    const cards = window.SERVICES.map((s) => {
      const pos = store.get('pos:' + s.id, 0);
      const pct = pos > 2 ? Math.round((pos / (s.blocks.length - 1)) * 100) : 0;
      return `<button class="svc-card" data-id="${s.id}">
        <span class="svc-name">${esc(s.name)}</span>
        <span class="svc-sub">${esc(s.subtitle)}</span>
        ${pct ? `<span class="svc-resume">გაგრძელება · ${pct}%</span>` : ''}
      </button>`;
    }).join('');
    app.innerHTML = `<div class="home">
      <div class="home-cross">☩</div>
      <h1>მეუფის კონდაკი</h1>
      <p class="tagline">წესი და განგება მღვდელმთავრის მსახურებისა</p>
      ${cards}
      <p class="foot">აირჩიეთ მსახურება · ტექსტი ინახება თქვენს მოწყობილობაზე</p>
    </div>`;
    app.querySelectorAll('.svc-card').forEach((b) =>
      b.addEventListener('click', () => { location.hash = '/' + b.dataset.id; }));
    window.scrollTo(0, 0);
  }

  // ── reader ──
  let scrollTimer = null;

  function blockHtml(b, i) {
    switch (b.t) {
      case 'say':
        return `<div class="say role-${b.role}" data-i="${i}">
          <span class="who">${esc(b.who)}</span><p>${esc(b.text)}</p></div>`;
      case 'rubric':
        return `<div class="rubric" data-i="${i}">${esc(b.text)}</div>`;
      case 'prayer':
        return `<div class="prayer" data-i="${i}">${esc(b.text)}</div>`;
      case 'head':
        return `<h2 class="head" data-i="${i}">${esc(b.text)}</h2>`;
      case 'sep':
        return `<div class="sep" data-i="${i}"></div>`;
      default:
        return '';
    }
  }

  function renderReader(svc) {
    document.title = svc.name + ' · მეუფის კონდაკი';
    app.innerHTML = `
      <div class="progress"></div>
      <header class="topbar">
        <button class="back" aria-label="უკან">‹</button>
        <div class="titles">
          <div class="t-name">${esc(svc.name)}</div>
          <div class="t-sec"></div>
        </div>
        <button class="menu-btn" aria-label="სარჩევი">☰</button>
      </header>
      <main class="reader">
        ${svc.blocks.map(blockHtml).join('')}
        <div class="fin">☩</div>
      </main>
      <button class="fab-top" aria-label="თავიდან" hidden>↑</button>
      <div class="scrim" hidden></div>
      <div class="sheet" hidden>
        <div class="grip"></div>
        <div class="controls">
          <div class="ctl"><button data-act="f-">A−</button><button data-act="f+">A+</button></div>
          <div class="ctl"><button data-act="theme">${theme === 'light' ? '☾ ბნელი' : '☀ ნათელი'}</button></div>
          <div class="ctl"><button data-act="rubrics" class="${showRubrics ? 'on' : ''}">განგება</button></div>
          <div class="ctl"><button data-act="wake" class="${wakeWanted ? 'on' : ''}">⏾ ეკრანი</button></div>
        </div>
        <nav class="toc">
          ${svc.toc.map((t, n) => `<button data-go="${t.i}"><span class="n">${n + 1}</span>${esc(t.text)}</button>`).join('')}
        </nav>
      </div>`;

    const $ = (sel) => app.querySelector(sel);
    const sheet = $('.sheet'), scrim = $('.scrim');
    const tSec = $('.t-sec'), bar = $('.progress');
    const fabTop = $('.fab-top');

    $('.back').addEventListener('click', () => { location.hash = ''; });
    fabTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    function openSheet() {
      sheet.hidden = scrim.hidden = false;
      requestAnimationFrame(() => document.body.classList.add('sheet-open'));
      markCurrentToc();
    }
    function closeSheet() {
      document.body.classList.remove('sheet-open');
      setTimeout(() => { sheet.hidden = scrim.hidden = true; }, 300);
    }
    $('.menu-btn').addEventListener('click', openSheet);
    scrim.addEventListener('click', closeSheet);

    sheet.addEventListener('click', (e) => {
      const go = e.target.closest('[data-go]');
      if (go) {
        const el = app.querySelector(`[data-i="${go.dataset.go}"]`);
        if (el) {
          closeSheet();
          const y = el.getBoundingClientRect().top + window.scrollY - 86;
          window.scrollTo({ top: y, behavior: 'auto' });
        }
        return;
      }
      const act = e.target.closest('[data-act]');
      if (!act) return;
      switch (act.dataset.act) {
        case 'f-': fontScale = Math.max(0.8, +(fontScale - 0.1).toFixed(2)); store.set('font', fontScale); break;
        case 'f+': fontScale = Math.min(1.7, +(fontScale + 0.1).toFixed(2)); store.set('font', fontScale); break;
        case 'theme':
          theme = theme === 'light' ? 'dark' : 'light';
          store.set('theme', theme);
          act.textContent = theme === 'light' ? '☾ ბნელი' : '☀ ნათელი';
          break;
        case 'rubrics':
          showRubrics = !showRubrics;
          store.set('rubrics', showRubrics);
          act.classList.toggle('on', showRubrics);
          break;
        case 'wake':
          wakeWanted = !wakeWanted;
          store.set('wake', wakeWanted);
          act.classList.toggle('on', wakeWanted);
          if (wakeWanted) acquireWake(); else releaseWake();
          break;
      }
      applySettings();
    });

    // current top block + section + progress + saved position
    const blockEls = Array.from(app.querySelectorAll('[data-i]'));

    function topBlockIndex() {
      const probe = 90;
      let lo = 0;
      for (const el of blockEls) {
        if (el.getBoundingClientRect().bottom > probe) return +el.dataset.i;
        lo = +el.dataset.i;
      }
      return lo;
    }

    function sectionFor(i) {
      let cur = svc.toc[0];
      for (const t of svc.toc) { if (t.i <= i) cur = t; else break; }
      return cur;
    }

    function markCurrentToc() {
      const i = topBlockIndex();
      const cur = sectionFor(i);
      sheet.querySelectorAll('.toc button').forEach((b) => b.classList.toggle('cur', +b.dataset.go === cur.i));
      const curBtn = sheet.querySelector('.toc button.cur');
      if (curBtn) curBtn.scrollIntoView({ block: 'center' });
    }

    function onScroll() {
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.style.width = (max > 0 ? (scrollY / max) * 100 : 0) + '%';
      const i = topBlockIndex();
      tSec.textContent = sectionFor(i).text;
      fabTop.hidden = scrollY < innerHeight * 1.5;
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => store.set('pos:' + svc.id, i), 400);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    activeScrollHandler = onScroll;

    // restore position: keep re-anchoring to the saved block for a short
    // window, because hash navigation and late font loading can reset or
    // shift the scroll position after our first scrollTo (notably Safari).
    const saved = store.get('pos:' + svc.id, 0);
    const savedEl = saved > 2 && app.querySelector(`[data-i="${saved}"]`);
    if (savedEl) {
      let userTookOver = false;
      const stop = () => { userTookOver = true; };
      ['wheel', 'touchstart', 'keydown'].forEach((ev) =>
        window.addEventListener(ev, stop, { once: true, passive: true }));
      const anchor = () => {
        const y = Math.max(0, savedEl.getBoundingClientRect().top + window.scrollY - 86);
        if (Math.abs(window.scrollY - y) > 4) window.scrollTo(0, y);
      };
      anchor();
      const t0 = performance.now();
      (function watch() {
        if (userTookOver || performance.now() - t0 > 800) return;
        anchor();
        requestAnimationFrame(watch);
      })();
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => { if (!userTookOver) anchor(); });
      }
    } else {
      window.scrollTo(0, 0);
    }
    onScroll();

    if (wakeWanted) acquireWake();
  }

  route();
})();
