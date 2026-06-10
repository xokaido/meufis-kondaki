/* მეუფის კონდაკი — reader logic */
(function () {
  'use strict';

  const app = document.getElementById('app');

  // We restore reading positions ourselves; the browser's per-history-entry
  // scroll restoration fights it (Safari applies it async after hashchange).
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const store = {
    get(k, d) { try { const v = localStorage.getItem('mk:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('mk:' + k, JSON.stringify(v)); } catch {} },
  };

  // ── settings ──
  let fontScale = store.get('font', 1);
  const systemTheme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  let theme = store.get('theme', systemTheme);
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

  // ── data: lightweight index up front, per-service blocks on demand ──
  let INDEX = [];
  const loadedServices = {};

  async function fetchJson(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(url + ': ' + r.status);
    return r.json();
  }

  function loadService(id) {
    if (!loadedServices[id]) {
      loadedServices[id] = fetchJson('data/' + id + '.json')
        .catch((err) => { delete loadedServices[id]; throw err; });
    }
    return loadedServices[id];
  }

  function renderError() {
    app.innerHTML = `<div class="home"><header class="hero">
      <div class="home-cross" aria-hidden="true">☩</div>
      <h1>ვერ ჩაიტვირთა</h1>
      <p class="tagline">შეამოწმეთ კავშირი და სცადეთ ხელახლა</p>
      <button class="svc-card" style="margin-top:24px" onclick="location.reload()">
        <span class="svc-name">განახლება</span></button>
    </header></div>`;
  }

  // ── routing ──
  let routeToken = 0;
  async function route() {
    // reader scroll listeners live on .scrollwrap and die with it
    document.body.classList.remove('sheet-open');
    const token = ++routeToken;
    const id = location.hash.replace(/^#\/?/, '');
    const meta = INDEX.find((s) => s.id === id);
    if (!meta) {
      renderHome();
    } else {
      try {
        const data = await loadService(id);
        if (token !== routeToken) return;
        renderReader({ ...meta, blocks: data.blocks, toc: data.toc });
      } catch {
        if (token !== routeToken) return;
        renderError();
      }
    }
    applySettings();
  }
  window.addEventListener('hashchange', route);

  // ── home ──
  function renderHome() {
    document.title = 'მეუფის კონდაკი';
    const card = (s, cls) => {
      const pos = store.get('pos:' + s.id, 0);
      const pct = pos > 2 ? Math.min(100, Math.round((pos / (s.blockCount - 1)) * 100)) : 0;
      return `<button class="svc-card${cls}" data-id="${s.id}" aria-label="${esc(s.name)}${pct ? `, წაკითხულია ${pct}%` : ''}">
        <span class="svc-row">
          <span class="svc-main">
            <span class="svc-name">${esc(s.name)}</span>
            <span class="svc-sub">${esc(s.subtitle)}</span>
          </span>
          <span class="svc-go" aria-hidden="true">›</span>
        </span>
        ${pct ? `<span class="svc-progress" aria-hidden="true"><i style="width:${pct}%"></i></span>
        <span class="svc-meta">გაგრძელება · ${pct}%</span>` : ''}
      </button>`;
    };
    const main = INDEX.filter((s) => !s.group).map((s) => card(s, '')).join('');
    const extra = INDEX.filter((s) => s.group).map((s) => card(s, ' sm')).join('');
    app.innerHTML = `<div class="home">
      <button class="theme-btn" aria-label="${theme === 'light' ? 'ბნელი თემა' : 'ნათელი თემა'}">${theme === 'light' ? '☾' : '☀'}</button>
      <header class="hero">
        <div class="home-cross" aria-hidden="true">☩</div>
        <h1>მეუფის კონდაკი</h1>
        <p class="tagline">წესი და განგება მღვდელმთავრის მსახურებისა</p>
      </header>
      <h2 class="home-sect">მსახურებანი</h2>
      ${main}
      ${extra ? `<h2 class="home-sect">ლოცვანი და განგებანი</h2>${extra}` : ''}
      <p class="foot">ტექსტი და თქვენი ადგილი ინახება ამ მოწყობილობაზე</p>
    </div>`;
    app.querySelectorAll('.svc-card').forEach((b) =>
      b.addEventListener('click', () => { location.hash = '/' + b.dataset.id; }));
    app.querySelector('.theme-btn').addEventListener('click', (e) => {
      theme = theme === 'light' ? 'dark' : 'light';
      store.set('theme', theme);
      applySettings();
      e.currentTarget.textContent = theme === 'light' ? '☾' : '☀';
      e.currentTarget.setAttribute('aria-label', theme === 'light' ? 'ბნელი თემა' : 'ნათელი თემა');
    });
    window.scrollTo(0, 0);
  }

  // ── reader ──
  let scrollTimer = null;

  // role icons (stroke = role color via currentColor)
  const ICONS = {
    bishop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5v19M8.5 6h7M6.5 10h11M8.5 16.5l7-3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>',
    priest: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5v17M7 9h10" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" fill="none"/></svg>',
    deacon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="16" r="3.8" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M12 12.2V8.5M12 8.5 8.8 4.2M12 8.5l3.2-4.3M9 4h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>',
    choir: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="17.5" r="2.4" fill="currentColor"/><circle cx="16.5" cy="15.8" r="2.4" fill="currentColor"/><path d="M10.4 17.5V7.2l8.5-2v10.6M10.4 9.4l8.5-2" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>',
    reader: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.3C10.2 5 7.8 4.4 4.8 4.6V18c3-.2 5.4.4 7.2 1.7 1.8-1.3 4.2-1.9 7.2-1.7V4.6c-3-.2-5.4.4-7.2 1.7Zm0 0v13.4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/></svg>',
  };

  function blockHtml(b, i) {
    switch (b.t) {
      case 'say':
        return `<div class="say role-${b.role}" data-i="${i}">
          <span class="who">${ICONS[b.role] || ''}${esc(b.who)}</span><p>${esc(b.text)}</p></div>`;
      case 'rubric':
        return `<div class="rubric" data-i="${i}">${esc(b.text)}</div>`;
      case 'text':
        return `<div class="text" data-i="${i}">${esc(b.text)}</div>`;
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

  // Collapsible prayer groups. Strict rule: a heading followed IMMEDIATELY by
  // one or more consecutive prayer blocks becomes a <details> group covering
  // exactly that run. Anything else (a rubric or spoken line in between)
  // breaks the group, so block order is never changed — only wrapped.
  function renderBlocks(blocks) {
    const out = [];
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.t === 'head' && i + 1 < blocks.length && blocks[i + 1].t === 'prayer') {
        let j = i + 1;
        while (j < blocks.length && blocks[j].t === 'prayer') j++;
        out.push(`<details class="pgroup" open><summary><h2 class="head" data-i="${i}">${esc(b.text)}<span class="tog">▾</span></h2></summary>`);
        for (let k = i + 1; k < j; k++) out.push(blockHtml(blocks[k], k));
        out.push('</details>');
        i = j - 1;
        continue;
      }
      out.push(blockHtml(b, i));
    }
    return out.join('');
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
      <div class="scrollwrap" tabindex="-1">
        <main class="reader">
          ${renderBlocks(svc.blocks)}
          <div class="fin">☩</div>
        </main>
      </div>
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
    // The reader scrolls inside this container, not the window: browsers
    // re-apply window scroll positions on hash navigation (Safari does it
    // asynchronously), but they never touch an inner element's scrollTop.
    const scroller = $('.scrollwrap');

    $('.back').addEventListener('click', () => { location.hash = ''; });
    fabTop.addEventListener('click', () => scroller.scrollTo({ top: 0, behavior: 'smooth' }));

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
        const el = jumpTarget(+go.dataset.go);
        if (el) {
          closeSheet();
          const y = el.getBoundingClientRect().top + scroller.scrollTop - 86;
          scroller.scrollTo({ top: y, behavior: 'auto' });
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

    // A block can be invisible (hidden rubric, collapsed group): fall forward
    // to the nearest block that actually has layout so jumps never compute
    // a position from an empty rect.
    function jumpTarget(i) {
      const exact = app.querySelector(`[data-i="${i}"]`);
      if (exact) {
        const grp = exact.closest('details.pgroup');
        if (grp && !grp.open) grp.open = true;
        if (exact.getClientRects().length) return exact;
      }
      for (const el of blockEls) {
        if (+el.dataset.i >= i && el.getClientRects().length) return el;
      }
      return exact;
    }

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
      const max = scroller.scrollHeight - scroller.clientHeight;
      bar.style.width = (max > 0 ? (scroller.scrollTop / max) * 100 : 0) + '%';
      const i = topBlockIndex();
      tSec.textContent = sectionFor(i).text;
      fabTop.hidden = scroller.scrollTop < scroller.clientHeight * 1.5;
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => store.set('pos:' + svc.id, i), 400);
    }
    scroller.addEventListener('scroll', onScroll, { passive: true });

    // restore position: the container's scrollTop is ours alone, so a single
    // set works; re-anchor once after fonts load (layout shift), unless the
    // user has started scrolling.
    const saved = store.get('pos:' + svc.id, 0);
    const savedEl = saved > 2 && jumpTarget(saved);
    if (savedEl) {
      const targetY = () =>
        Math.max(0, savedEl.getBoundingClientRect().top + scroller.scrollTop - 86);
      scroller.scrollTop = targetY();
      let userTookOver = false;
      const stop = () => { userTookOver = true; };
      ['wheel', 'touchstart', 'keydown'].forEach((ev) =>
        scroller.addEventListener(ev, stop, { once: true, passive: true }));
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => { if (!userTookOver) scroller.scrollTop = targetY(); });
      }
    }
    onScroll();

    if (wakeWanted) acquireWake();
  }

  // ── boot ──
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  fetchJson('data/index.json')
    .then((idx) => { INDEX = idx; route(); })
    .catch(renderError);
})();
