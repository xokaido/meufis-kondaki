> **ისტორიული დოკუმენტი / Historical document.** Snapshot of its date; paths and architecture may no longer match the current repo. See README.md for the current layout.

# მეუფის კონდაკი Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the liturgical PWA as a Svelte 5 + Vite app with category navigation, full-text search, role highlighting, and a live-service follow mode, in the approved vellum/illuminated design language.

**Architecture:** Static offline-first PWA. `build.cjs` (Node, no deps) parses Georgian markdown into per-text JSON + a search index under `public/data/`. Svelte 5 (runes) renders four views (Home, Category, Reader with embedded Follow mode, plus a Search overlay) behind a hand-rolled hash router. State persists in localStorage under the existing `mk:` keys. `vite-plugin-pwa` (Workbox) replaces the hand-rolled service worker.

**Tech Stack:** Svelte 5, Vite, vite-plugin-pwa, vitest (+jsdom), @playwright/test (smoke only). No runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-06-12-redesign-design.md` — read it first. All UI text is Georgian; copy strings exactly as written here.

**Branch:** all work on `feature/redesign`. Never merge to main.

**Context for the implementer:**
- The current app lives in `app/` (vanilla JS, hand-rolled SW). It gets deleted in Task 4 after the new shell boots. The old `app/app.js` is the reference for hard-won iOS scroll behaviors — its logic is ported verbatim into the Reader below; don't "improve" it.
- Block JSON shape (unchanged): `{t:'say',role,who,text} | {t:'rubric'|'text'|'prayer'|'head',text} | {t:'sep'}`. TOC shape: `[{text, i}]` where `i` is a block index.
- localStorage keys (must keep working for existing users): `mk:theme`, `mk:font`, `mk:rubrics`, `mk:wake`, `mk:speed`, `mk:pos:<id>` (block index). New keys: `mk:role`, `mk:last`.
- Old URLs `#/vespers` etc. must redirect to `#/t/vespers`.

---

## Phase 1 — Scaffold, data pipeline, tokens

### Task 1: npm scaffold

**Files:**
- Create: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "meufis-kondaki",
  "private": true,
  "type": "module",
  "scripts": {
    "data": "node build.cjs",
    "dev": "node build.cjs && vite",
    "build": "node build.cjs && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Install dev dependencies**

Run:
```bash
npm install -D svelte @sveltejs/vite-plugin-svelte vite vite-plugin-pwa vitest jsdom
```
Expected: package.json gains devDependencies; `package-lock.json` and `node_modules/` appear.

- [ ] **Step 3: Extend `.gitignore`**

Append to `.gitignore`:
```
node_modules/
dist/
dev-dist/
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "build: scaffold npm project for Svelte/Vite rewrite"
```

### Task 2: Refactor build.js → build.cjs (testable, categories, search index, no SW)

**Files:**
- Rename+Modify: `build.js` → `build.cjs`
- Delete: `sw.template.js`
- Create: `tests/build.test.js`, `vitest.config.js`

The parser logic (`parseLines`, `roleFor`, `LANDMARKS`, sectioned-file splitting) is **unchanged**. Changes: (a) wrap top-level execution in `main()` guarded by `require.main === module` and export internals; (b) add per-text `category`; (c) emit `index.json` as `{categories, texts}`; (d) emit `search-index.json`; (e) output to `public/data/`; (f) delete service-worker generation (Workbox replaces it).

- [ ] **Step 1: Write `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
  },
});
```

- [ ] **Step 2: Write the failing test `tests/build.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { parseLines, roleFor, searchEntries, CATEGORIES, SOURCES, SECTIONS } = require('../build.cjs');

describe('roleFor', () => {
  it('maps speaker labels to roles', () => {
    expect(roleFor('დიაკონი')).toBe('deacon');
    expect(roleFor('გუნდი')).toBe('choir');
    expect(roleFor('მღვდელმთავარი')).toBe('bishop');
    expect(roleFor('მკითხველი')).toBe('reader');
    expect(roleFor('არავინ')).toBe(null);
  });
});

describe('parseLines', () => {
  const lines = [
    '**დასაწყისი**',
    '',
    'დიაკონი: მშვიდობით უფლისა მიმართ ვილოცოთ.',
    '',
    'გუნდი: უფალო, შეგვიწყალენ.',
  ];
  it('parses speaker blocks with roles', () => {
    const { blocks } = parseLines(lines, 'x', false);
    expect(blocks[0]).toEqual({ t: 'head', text: 'დასაწყისი' });
    expect(blocks[1]).toEqual({ t: 'say', role: 'deacon', who: 'დიაკონი', text: 'მშვიდობით უფლისა მიმართ ვილოცოთ.' });
    expect(blocks[2].role).toBe('choir');
  });
});

describe('categories', () => {
  it('every source text has a category', () => {
    for (const s of [...SOURCES, ...SECTIONS]) {
      expect(['services', 'rites', 'prayers']).toContain(s.category);
    }
  });
  it('CATEGORIES lists browsable + coming-soon categories in order', () => {
    expect(CATEGORIES.map((c) => c.id)).toEqual(['services', 'rites', 'prayers', 'propers', 'scores']);
    expect(CATEGORIES.find((c) => c.id === 'propers').soon).toBe(true);
  });
});

describe('searchEntries', () => {
  it('emits [blockIndex, sectionTitle, plainText] per searchable block', () => {
    const svc = {
      blocks: [
        { t: 'head', text: 'დასაწყისი' },
        { t: 'say', role: 'deacon', who: 'დიაკონი', text: 'მშვიდობით *უფლისა* მიმართ ვილოცოთ.' },
        { t: 'sep' },
        { t: 'prayer', text: 'წმიდაო ღმერთო' },
      ],
      toc: [{ text: 'დასაწყისი', i: 0 }],
    };
    const e = searchEntries(svc);
    expect(e).toEqual([
      [0, 'დასაწყისი', 'დასაწყისი'],
      [1, 'დასაწყისი', 'დიაკონი: მშვიდობით უფლისა მიმართ ვილოცოთ.'],
      [3, 'დასაწყისი', 'წმიდაო ღმერთო'],
    ]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run`
Expected: FAIL — cannot resolve `../build.cjs`.

- [ ] **Step 4: Create `build.cjs`**

`git mv build.js build.cjs`, then apply these changes (parser body untouched):

1. Add `category` to every entry: in `SOURCES`, each of the three gets `category: 'services'`. In `SECTIONS`: `kmevebi`, `paraklisi`, `litanioba`, `jvari`, `kurtxevani` get `category: 'rites'`; `ziareba`, `gansatevebelni` get `category: 'prayers'`.

2. Add after `SECTIONS`:

```js
const CATEGORIES = [
  { id: 'services', name: 'მსახურებანი' },
  { id: 'rites', name: 'განგებანი' },
  { id: 'prayers', name: 'ლოცვანი' },
  { id: 'propers', name: 'დღესასწაულნი', soon: true },
  { id: 'scores', name: 'საგალობლები', soon: true },
];
```

3. Add near the bottom (above output):

```js
// Search index: per text, [blockIndex, owningSectionTitle, plainText]
// for every block that has text. Emphasis markers stripped.
function searchEntries(svc) {
  const sectionFor = (i) => {
    let cur = '';
    for (const t of svc.toc) { if (t.i <= i) cur = t.text; else break; }
    return cur;
  };
  const entries = [];
  svc.blocks.forEach((b, i) => {
    const text = ((b.who ? b.who + ': ' : '') + (b.text || '')).replace(/\*/g, '').trim();
    if (text) entries.push([i, sectionFor(i), text]);
  });
  return entries;
}
```

4. Replace everything from `const services = [];` to the end of the file with:

```js
function main() {
  const services = [];

  for (const src of SOURCES) {
    const { blocks, toc } = parseLines(readLines(src.file), src.id, true);
    services.push({ ...src, blocks, toc });
  }

  {
    const lines = readLines(SECTIONED_FILE);
    const starts = SECTIONS.map((s) => {
      const i = lines.findIndex((l) => l.trim() === s.title);
      if (i === -1) throw new Error(`section title not found: ${s.title}`);
      return i;
    });
    for (let k = 1; k < starts.length; k++) {
      if (starts[k] <= starts[k - 1]) throw new Error('section titles out of order');
    }
    SECTIONS.forEach((s, k) => {
      let end = k + 1 < starts.length ? starts[k + 1] : lines.length;
      if (s.endTitle) {
        const e = lines.findIndex((l, i) => i > starts[k] && l.trim() === s.endTitle);
        if (e !== -1 && e < end) end = e;
      }
      const chunk = lines.slice(starts[k] + 1, end);
      const { blocks, toc } = parseLines(chunk, s.id, false, s.mode);
      services.push({ ...s, blocks, toc });
    });
  }

  const dataDir = path.join(__dirname, 'public', 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  const index = {
    categories: CATEGORIES,
    texts: services.map((s) => ({
      id: s.id, name: s.name, subtitle: s.subtitle, category: s.category, blockCount: s.blocks.length,
    })),
  };
  fs.writeFileSync(path.join(dataDir, 'index.json'), JSON.stringify(index));
  for (const s of services) {
    fs.writeFileSync(path.join(dataDir, s.id + '.json'), JSON.stringify({ blocks: s.blocks, toc: s.toc }));
  }
  fs.writeFileSync(path.join(dataDir, 'search-index.json'),
    JSON.stringify(services.map((s) => ({ id: s.id, name: s.name, entries: searchEntries(s) }))));

  for (const s of services) {
    const counts = {};
    for (const b of s.blocks) counts[b.t] = (counts[b.t] || 0) + 1;
    console.log(`${s.id}: ${s.blocks.length} blocks`, counts, `toc=${s.toc.length}`);
  }
}

module.exports = { parseLines, roleFor, searchEntries, CATEGORIES, SOURCES, SECTIONS };
if (require.main === module) main();
```

Note the SW-generation section (the `walk`/`crypto`/`sw.template.js` code) and the old `group:` fields are gone. Also `git rm sw.template.js`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run`
Expected: PASS (all 4 describe blocks).

- [ ] **Step 6: Run the generator and sanity-check output**

Run: `node build.cjs && node -e "const i=require('./public/data/index.json'); console.log(i.categories.length, i.texts.length); const s=require('./public/data/search-index.json'); console.log(s.length, s[0].entries.length)"`
Expected: build report for 10 texts; then `5 10` and `10 <several hundred>`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "build: testable build.cjs with categories and search index, drop hand-rolled SW"
```

### Task 3: Hash router (TDD)

**Files:**
- Create: `src/lib/router.js`, `tests/router.test.js`

- [ ] **Step 1: Write the failing test `tests/router.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { parseRoute } from '../src/lib/router.js';

describe('parseRoute', () => {
  it('empty hash → home', () => {
    expect(parseRoute('')).toEqual({ view: 'home' });
    expect(parseRoute('#/')).toEqual({ view: 'home' });
  });
  it('category route', () => {
    expect(parseRoute('#/cat/rites')).toEqual({ view: 'category', id: 'rites' });
  });
  it('reader route, with and without block param', () => {
    expect(parseRoute('#/t/vespers')).toEqual({ view: 'reader', id: 'vespers', block: null });
    expect(parseRoute('#/t/liturgy?b=42')).toEqual({ view: 'reader', id: 'liturgy', block: 42 });
  });
  it('legacy ids redirect to reader', () => {
    expect(parseRoute('#/vespers')).toEqual({ view: 'reader', id: 'vespers', block: null, redirect: '#/t/vespers' });
    expect(parseRoute('#/kurtxevani').redirect).toBe('#/t/kurtxevani');
  });
  it('unknown → home', () => {
    expect(parseRoute('#/nonsense/x')).toEqual({ view: 'home' });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/router.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/lib/router.js`**

```js
// Hash router. Pure parser — App.svelte owns the hashchange listener.
const LEGACY_IDS = ['vespers', 'matins', 'liturgy', 'kmevebi', 'paraklisi',
  'litanioba', 'jvari', 'ziareba', 'gansatevebelni', 'kurtxevani'];

export function parseRoute(hash) {
  const h = (hash || '').replace(/^#\/?/, '');
  const [path, query] = h.split('?');
  if (!path) return { view: 'home' };
  const seg = path.split('/').filter(Boolean);
  if (seg[0] === 'cat' && seg[1]) return { view: 'category', id: seg[1] };
  if (seg[0] === 't' && seg[1]) {
    const params = new URLSearchParams(query || '');
    return { view: 'reader', id: seg[1], block: params.has('b') ? +params.get('b') : null };
  }
  if (seg.length === 1 && LEGACY_IDS.includes(seg[0])) {
    return { view: 'reader', id: seg[0], block: null, redirect: '#/t/' + seg[0] };
  }
  return { view: 'home' };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/router.test.js` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/router.js tests/router.test.js
git commit -m "feat: hash router with legacy URL redirects"
```

### Task 4: Vite app shell, design tokens, asset move, old app removal

**Files:**
- Create: `vite.config.js`, `index.html`, `src/main.js`, `src/App.svelte`, `src/styles/tokens.css`, `src/styles/global.css`, `src/lib/store.js`, `src/lib/data.js`, `tests/store.test.js`
- Move: `app/fonts/` → `public/fonts/`, `app/icons/` → `public/icons/`
- Delete: rest of `app/`

- [ ] **Step 1: Move static assets, delete old app**

```bash
mkdir -p public
git mv app/fonts public/fonts
git mv app/icons public/icons
git rm -r app
echo "public/data/" >> .gitignore   # generated by build.cjs
```
(`app/data/*.json` and `app/sw.js` are generated files; deleting them with `git rm -r app` is correct — `build.cjs` regenerates into `public/data/`.)

- [ ] **Step 2: Write `vite.config.js`**

```js
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // relative base: works at gulani.ge root AND xokaido.github.io/meufis-kondaki/
  base: './',
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      // keep the SW filename the old app used so installed clients update in place
      filename: 'sw.js',
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,json,webmanifest}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      manifest: {
        name: 'გულანი',
        short_name: 'გულანი',
        description: 'წესი და განგება მღვდელმთავრის მსახურებისა',
        lang: 'ka',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#191310',
        theme_color: '#191310',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
```

- [ ] **Step 3: Write `index.html`** (project root — Vite's entry)

```html
<!DOCTYPE html>
<html lang="ka">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#191310">
<title>მეუფის კონდაკი</title>
<link rel="icon" type="image/png" href="./icons/icon-192.png">
<link rel="apple-touch-icon" href="./icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="გულანი">
<link rel="stylesheet" href="./fonts/fonts.css">
</head>
<body>
<div id="app"></div>
<script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Write `src/styles/tokens.css`** (the validated vellum palettes)

```css
/* მეუფის კონდაკი — vellum / illuminated design tokens */
:root {
  /* light: parchment */
  --bg: #f6efdd;
  --bg-raise: #efe5cb;
  --bg-sheet: #fbf5e6;
  --ink: #33291b;
  --ink-soft: #564a37;
  --muted: #8a7a5c;
  --accent: #9e2b25;          /* true rubric red */
  --accent-soft: rgba(158, 43, 37, 0.07);
  --line: #e2d6b8;
  --c-bishop: #7d4a9e;
  --c-priest: #aa4f2e;
  --c-deacon: #8a6510;
  --c-choir: #2e6e5a;
  --c-reader: #38618c;
  --shadow: 0 12px 32px rgba(90, 70, 30, 0.25);
  --fs: 1;
}

[data-theme="dark"] {
  /* dark: candlelit vellum */
  --bg: #191310;
  --bg-raise: #221a14;
  --bg-sheet: #281f18;
  --ink: #e8dcc2;
  --ink-soft: #cdbfa4;
  --muted: #9b8c74;
  --accent: #d4604f;          /* vermilion — rubric red readable on dark */
  --accent-soft: rgba(212, 96, 79, 0.1);
  --line: #2e2620;
  --c-bishop: #c49bdb;
  --c-priest: #d98e73;
  --c-deacon: #cfa14f;
  --c-choir: #9ec7b9;
  --c-reader: #8fb0d6;
  --shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
}
```

- [ ] **Step 5: Write `src/styles/global.css`**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }

body {
  background: var(--bg);
  color: var(--ink);
  font-family: "Noto Serif Georgian", "Sylfaen", Georgia, serif;
  line-height: 1.65;
  overscroll-behavior-y: none;
}

button {
  font: inherit;
  color: inherit;
  background: none;
  border: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.hide-rubrics .rubric { display: none; }
```

- [ ] **Step 6: Write the failing test `tests/store.test.js`**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { persisted, getPos, setPos, getLast, setLast } from '../src/lib/store.js';
import { get } from 'svelte/store';

beforeEach(() => localStorage.clear());

describe('persisted', () => {
  it('uses the default when nothing is stored', () => {
    expect(get(persisted('x1', 7))).toBe(7);
  });
  it('reads existing mk:-prefixed values (back-compat with old app)', () => {
    localStorage.setItem('mk:font', '1.3');
    expect(get(persisted('font', 1))).toBe(1.3);
  });
  it('writes back under mk: prefix', () => {
    const s = persisted('x2', 'a');
    s.set('b');
    expect(localStorage.getItem('mk:x2')).toBe('"b"');
  });
});

describe('positions', () => {
  it('round-trips a reading position and records last-read', () => {
    setPos('vespers', 42);
    expect(getPos('vespers')).toBe(42);
    expect(getLast().id).toBe('vespers');
  });
  it('getLast returns null when never set', () => {
    expect(getLast()).toBe(null);
  });
  it('setLast is explicit too', () => {
    setLast('matins');
    expect(getLast().id).toBe('matins');
  });
});
```

- [ ] **Step 7: Run to verify failure, then write `src/lib/store.js`**

Run: `npx vitest run tests/store.test.js` — Expected: FAIL (module not found).

```js
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
```

- [ ] **Step 8: Run to verify pass**

Run: `npx vitest run tests/store.test.js` — Expected: PASS.

- [ ] **Step 9: Write `src/lib/data.js`**

```js
// Data loading with in-memory memoization. Everything is also SW-precached,
// so these fetches are instant and offline-safe after first install.
const cache = {};

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ': ' + r.status);
  return r.json();
}

function memo(key, url) {
  if (!cache[key]) {
    cache[key] = fetchJson(url).catch((err) => { delete cache[key]; throw err; });
  }
  return cache[key];
}

export const loadIndex = () => memo('index', 'data/index.json');
export const loadText = (id) => memo('t:' + id, 'data/' + id + '.json');
export const loadSearchIndex = () => memo('search', 'data/search-index.json');
```

- [ ] **Step 10: Write `src/main.js`**

```js
import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import './styles/tokens.css';
import './styles/global.css';
import App from './App.svelte';

// The old hand-rolled SW used kondaki-* cache names; Workbox won't clean
// those. Delete them once so upgrading users don't carry dead caches.
if ('caches' in window) {
  caches.keys().then((keys) =>
    keys.filter((k) => k.startsWith('kondaki-')).forEach((k) => caches.delete(k)));
}

registerSW({ immediate: true });

mount(App, { target: document.getElementById('app') });
```

- [ ] **Step 11: Write `src/App.svelte`** (placeholder views for now — replaced in Phase 2/3)

```svelte
<script>
  import { parseRoute } from './lib/router.js';
  import { theme, fontScale, showRubrics } from './lib/store.js';

  let route = $state(parseRoute(location.hash));

  function onHash() {
    const r = parseRoute(location.hash);
    if (r.redirect) { location.replace(r.redirect); return; }
    route = r;
  }
  $effect(() => {
    addEventListener('hashchange', onHash);
    onHash(); // handle a legacy URL on initial load too
    return () => removeEventListener('hashchange', onHash);
  });

  // global settings → document
  $effect(() => {
    document.documentElement.dataset.theme = $theme;
    document.documentElement.style.setProperty('--fs', $fontScale);
    document.body.classList.toggle('hide-rubrics', !$showRubrics);
    const mc = document.querySelector('meta[name=theme-color]');
    if (mc) mc.content = $theme === 'light' ? '#f6efdd' : '#191310';
  });
</script>

{#if route.view === 'home'}
  <main style="padding:2rem"><h1>მეუფის კონდაკი</h1><p>placeholder home</p></main>
{:else if route.view === 'category'}
  <main style="padding:2rem"><p>placeholder category: {route.id}</p></main>
{:else}
  <main style="padding:2rem"><p>placeholder reader: {route.id}</p></main>
{/if}
```

- [ ] **Step 12: Boot it**

Run: `npm run dev` (background) then open http://localhost:5173 — Expected: parchment background, dark-mode aware, "მეუფის კონდაკი placeholder home"; `#/vespers` redirects to `#/t/vespers` showing placeholder reader. Run `npx vitest run` — all green. Stop the dev server.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: Svelte 5 + Vite + PWA shell with vellum tokens; remove old app/"
```

### Task 5: Deployment config

**Files:**
- Modify: `wrangler.jsonc`, `.github/workflows/deploy.yml`

- [ ] **Step 1: Update `wrangler.jsonc`**

```jsonc
{
  "name": "gulani-web",
  "compatibility_date": "2026-06-12",
  // full build: markdown → public/data JSON, then Vite bundle into dist/
  "build": {
    "command": "npm ci && npm run build"
  },
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  }
}
```

- [ ] **Step 2: Update `.github/workflows/deploy.yml`** — replace the two build/deploy steps:

```yaml
      - name: Install and build
        run: |
          npm ci
          npm run build

      - name: Deploy dist/ to gh-pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

- [ ] **Step 3: Verify a production build works**

Run: `npm run build && ls dist/sw.js dist/index.html dist/data/index.json`
Expected: build succeeds; all three paths listed.

- [ ] **Step 4: Commit**

```bash
git add wrangler.jsonc .github/workflows/deploy.yml
git commit -m "build: point Cloudflare and gh-pages deploys at Vite dist/"
```

**PHASE 1 CHECKPOINT — report to user:** scaffold, data pipeline, tokens, deploy config done; old app removed on this branch.

---

## Phase 2 — Navigation / IA

### Task 6: Home view (layout B)

**Files:**
- Create: `src/views/Home.svelte`, `src/lib/install.js`
- Modify: `src/App.svelte`

- [ ] **Step 1: Write `src/lib/install.js`** (straight port of the old install-prompt logic)

```js
// Android/Chrome: real one-tap install via beforeinstallprompt.
// iOS: no install API exists — caller shows a two-step visual guide.
let installEvent = null;
const listeners = new Set();

export const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const isIOS = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
  listeners.forEach((fn) => fn(true));
});
addEventListener('appinstalled', () => {
  installEvent = null;
  listeners.forEach((fn) => fn(false));
});

export function onInstallable(fn) {
  listeners.add(fn);
  fn(!!installEvent);
  return () => listeners.delete(fn);
}

// Returns true if a native prompt was shown; false → caller shows iOS guide.
export function promptInstall() {
  if (!installEvent) return false;
  installEvent.prompt();
  return true;
}
```

- [ ] **Step 2: Write `src/views/Home.svelte`**

```svelte
<script>
  import { loadIndex } from '../lib/data.js';
  import { theme, role, getPos, getLast } from '../lib/store.js';
  import { roleName } from '../lib/roles.js';
  import { isStandalone, isIOS, onInstallable, promptInstall } from '../lib/install.js';

  let index = $state(null);
  let failed = $state(false);
  let installable = $state(false);
  let showGuide = $state(false);
  let roleSheetOpen = $state(false);

  loadIndex().then((i) => { index = i; }).catch(() => { failed = true; });
  $effect(() => onInstallable((v) => { installable = v; }));

  const services = $derived(index ? index.texts.filter((t) => t.category === 'services') : []);
  const tiles = $derived(index
    ? index.categories.filter((c) => c.id !== 'services').map((c) => ({
        ...c, count: index.texts.filter((t) => t.category === c.id).length,
      }))
    : []);

  const last = getLast();
  const cont = $derived.by(() => {
    if (!last || !index) return null;
    const t = index.texts.find((x) => x.id === last.id);
    if (!t) return null;
    const pos = getPos(t.id);
    if (pos <= 2) return null;
    return { ...t, pct: Math.min(100, Math.round((pos / (t.blockCount - 1)) * 100)) };
  });

  function pctFor(t) {
    const pos = getPos(t.id);
    return pos > 2 ? Math.min(100, Math.round((pos / (t.blockCount - 1)) * 100)) : 0;
  }
  function toggleTheme() { theme.update((t) => (t === 'light' ? 'dark' : 'light')); }
  function install() { if (!promptInstall()) showGuide = true; }
</script>

<div class="home">
  <header class="hdr">
    <span class="cross" aria-hidden="true">☩</span>
    <h1>მეუფის კონდაკი</h1>
    <button class="badge" onclick={() => { roleSheetOpen = true; }} aria-label="როლის არჩევა">
      {$role ? roleName($role) : 'როლი —'}
    </button>
  </header>
  <p class="tagline">წესი და განგება მღვდელმთავრის მსახურებისა</p>

  {#if failed}
    <div class="err">
      <p>ვერ ჩაიტვირთა — შეამოწმეთ კავშირი</p>
      <button class="card" onclick={() => location.reload()}><span class="nm">განახლება</span></button>
    </div>
  {:else if index}
    {#if cont}
      <a class="cont" href="#/t/{cont.id}">
        <span class="lbl">გაგრძელება</span>
        <span class="nm">{cont.name}</span>
        <span class="pr"><i style="width:{cont.pct}%"></i></span>
      </a>
    {/if}

    <h2 class="sect">მსახურებანი</h2>
    {#each services as t (t.id)}
      <a class="card" href="#/t/{t.id}">
        <span class="main"><span class="nm">{t.name}</span><span class="sb">{t.subtitle}</span></span>
        <span class="go" aria-hidden="true">›</span>
        {#if pctFor(t)}<span class="pr" aria-label="წაკითხულია {pctFor(t)}%"><i style="width:{pctFor(t)}%"></i></span>{/if}
      </a>
    {/each}

    <h2 class="sect">ბიბლიოთეკა</h2>
    <div class="tiles">
      {#each tiles as c (c.id)}
        {#if c.soon}
          <span class="tile soon"><span class="nm">{c.name}</span><span class="ct">მალე</span></span>
        {:else}
          <a class="tile" href="#/cat/{c.id}">
            <span class="nm">{c.name}</span><span class="ct">{c.count} ტექსტი</span>
          </a>
        {/if}
      {/each}
    </div>

    <div class="foot-row">
      {#if installable || (!isStandalone() && isIOS())}
        <button class="install" onclick={install}>დააყენეთ ტელეფონზე</button>
      {/if}
      <button class="theme" onclick={toggleTheme} aria-label="თემა">{$theme === 'light' ? '☾' : '☀'}</button>
    </div>
    <p class="foot">ტექსტი და თქვენი ადგილი ინახება ამ მოწყობილობაზე</p>
  {/if}

  {#if showGuide}
    <div class="guide" role="dialog" aria-label="დაყენების ინსტრუქცია">
      <button class="scrim" onclick={() => { showGuide = false; }} aria-label="დახურვა"></button>
      <div class="gsheet">
        <h3>დააყენეთ ტელეფონზე</h3>
        <ol>
          <li>{isIOS() ? 'Safari-ში' : 'ბრაუზერში'} შეეხეთ <b>გაზიარების</b> ღილაკს</li>
          <li>აირჩიეთ <b>„ეკრანზე დამატება"</b></li>
        </ol>
        <p>ამის შემდეგ აპლიკაცია გაიხსნება სრულ ეკრანზე და იმუშავებს ინტერნეტის გარეშეც.</p>
        <button class="ok" onclick={() => { showGuide = false; }}>გასაგებია</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .home { max-width: 560px; margin: 0 auto; padding: max(14px, env(safe-area-inset-top)) 16px 32px; }
  .hdr { display: flex; align-items: center; gap: 10px; padding-top: 10px; }
  .cross { color: var(--accent); font-size: 20px; }
  h1 { font-size: 19px; flex: 1; }
  .badge { font-size: 12px; border: 1px solid var(--line); background: var(--bg-sheet); border-radius: 99px; padding: 4px 11px; color: var(--c-choir); font-weight: 700; }
  .tagline { color: var(--muted); font-size: 13px; margin: 4px 0 18px; }
  .cont { display: block; text-decoration: none; color: inherit; background: var(--accent-soft); border: 1px solid var(--line); border-radius: 12px; padding: 10px 14px; margin-bottom: 18px; }
  .cont .lbl { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--accent); font-weight: 700; display: block; }
  .cont .nm { font-weight: 600; }
  .pr { display: block; height: 3px; background: var(--line); border-radius: 2px; margin-top: 8px; overflow: hidden; }
  .pr i { display: block; height: 3px; background: var(--accent); border-radius: 2px; }
  .sect { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin: 18px 0 9px; font-weight: 700; }
  .card { display: block; text-decoration: none; color: inherit; position: relative; background: var(--bg-sheet); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; margin-bottom: 9px; }
  .card .main { display: inline-flex; flex-direction: column; width: calc(100% - 20px); }
  .card .nm { font-size: 16px; font-weight: 600; }
  .card .sb { font-size: 12px; color: var(--muted); }
  .card .go { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); color: var(--muted); }
  .tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
  .tile { display: flex; flex-direction: column; text-decoration: none; color: inherit; background: var(--bg-sheet); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; }
  .tile .nm { font-weight: 700; font-size: 14px; }
  .tile .ct { font-size: 11px; color: var(--muted); margin-top: 2px; }
  .tile.soon { opacity: .55; }
  .foot-row { display: flex; align-items: center; gap: 10px; margin-top: 22px; }
  .install { flex: 1; border: 1px solid var(--accent); color: var(--accent); border-radius: 10px; padding: 10px; font-weight: 600; }
  .theme { border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; }
  .foot { text-align: center; color: var(--muted); font-size: 11.5px; margin-top: 14px; }
  .err { text-align: center; padding: 40px 0; color: var(--muted); }
  .guide { position: fixed; inset: 0; z-index: 50; }
  .scrim { position: absolute; inset: 0; background: rgba(0,0,0,.45); width: 100%; }
  .gsheet { position: absolute; left: 0; right: 0; bottom: 0; background: var(--bg-sheet); border-radius: 18px 18px 0 0; padding: 22px 20px calc(22px + env(safe-area-inset-bottom)); }
  .gsheet ol { padding-left: 22px; margin: 12px 0; }
  .gsheet li { margin-bottom: 8px; }
  .gsheet p { color: var(--muted); font-size: 13px; }
  .ok { width: 100%; margin-top: 12px; background: var(--accent); color: var(--bg); border-radius: 10px; padding: 11px; font-weight: 700; }
</style>
```

Note: `roleName` and the role sheet come from Tasks 13/14 — for now create a minimal `src/lib/roles.js` stub so this compiles, which Task 13 replaces test-first:

```js
export function roleName(id) { return id; }
```

and ignore `roleSheetOpen` (the badge is inert until Phase 5).

- [ ] **Step 3: Wire into `src/App.svelte`** — replace the home placeholder branch:

```svelte
  import Home from './views/Home.svelte';
  ...
{#if route.view === 'home'}
  <Home />
{:else if ...}
```

- [ ] **Step 4: Verify in dev server**

Run: `npm run dev`, open http://localhost:5173 — Expected: header with cross/title/role chip, three service cards, tile grid with განგებანი (5 ტექსტი), ლოცვანი (2 ტექსტი), and two dimmed "მალე" tiles; theme toggle works and persists across reload.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: home view — pinned services, category tiles, continue card, install prompt"
```

### Task 7: Category view

**Files:**
- Create: `src/views/Category.svelte`
- Modify: `src/App.svelte`

- [ ] **Step 1: Write `src/views/Category.svelte`**

```svelte
<script>
  import { loadIndex } from '../lib/data.js';
  import { getPos } from '../lib/store.js';

  let { id } = $props();
  let index = $state(null);
  loadIndex().then((i) => { index = i; });

  const cat = $derived(index ? index.categories.find((c) => c.id === id) : null);
  const texts = $derived(index ? index.texts.filter((t) => t.category === id) : []);
  function pctFor(t) {
    const pos = getPos(t.id);
    return pos > 2 ? Math.min(100, Math.round((pos / (t.blockCount - 1)) * 100)) : 0;
  }
</script>

<div class="cat">
  <header class="bar">
    <a class="back" href="#/" aria-label="უკან">‹</a>
    <h1>{cat ? cat.name : ''}</h1>
  </header>
  {#each texts as t (t.id)}
    <a class="card" href="#/t/{t.id}">
      <span class="main"><span class="nm">{t.name}</span><span class="sb">{t.subtitle}</span></span>
      <span class="go" aria-hidden="true">›</span>
      {#if pctFor(t)}<span class="pr"><i style="width:{pctFor(t)}%"></i></span>{/if}
    </a>
  {/each}
</div>

<style>
  .cat { max-width: 560px; margin: 0 auto; padding: max(10px, env(safe-area-inset-top)) 16px 32px; }
  .bar { display: flex; align-items: center; gap: 6px; padding: 8px 0 14px; }
  .back { font-size: 26px; line-height: 1; text-decoration: none; color: var(--muted); padding: 0 8px 4px 0; }
  h1 { font-size: 17px; }
  .card { display: block; text-decoration: none; color: inherit; position: relative; background: var(--bg-sheet); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; margin-bottom: 9px; }
  .card .main { display: inline-flex; flex-direction: column; width: calc(100% - 20px); }
  .card .nm { font-size: 16px; font-weight: 600; }
  .card .sb { font-size: 12px; color: var(--muted); }
  .card .go { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); color: var(--muted); }
  .pr { display: block; height: 3px; background: var(--line); border-radius: 2px; margin-top: 8px; overflow: hidden; }
  .pr i { display: block; height: 3px; background: var(--accent); border-radius: 2px; }
</style>
```

- [ ] **Step 2: Wire into App.svelte** category branch: `<Category id={route.id} />`.

- [ ] **Step 3: Verify** — dev server: tapping განგებანი tile opens `#/cat/rites` listing 5 texts; back arrow returns home.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: category list view"
```

**PHASE 2 CHECKPOINT — report to user:** IA navigable end-to-end (home → category → placeholder reader; legacy URLs redirect).

---

## Phase 3 — Reader

### Task 8: Text formatting + block grouping helpers (TDD)

**Files:**
- Create: `src/lib/fmt.js`, `src/lib/blocks.js`, `tests/fmt.test.js`, `tests/blocks.test.js`

- [ ] **Step 1: Write failing tests**

`tests/fmt.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { esc, fmt } from '../src/lib/fmt.js';

describe('esc/fmt', () => {
  it('escapes HTML', () => {
    expect(esc('<b> & x')).toBe('&lt;b&gt; &amp; x');
  });
  it('renders *emphasis* as <em>', () => {
    expect(fmt('აქა *სიტყვა* არს')).toBe('აქა <em>სიტყვა</em> არს');
  });
  it('escapes before formatting', () => {
    expect(fmt('<i>*x*</i>')).toBe('&lt;i&gt;<em>x</em>&lt;/i&gt;');
  });
});
```

`tests/blocks.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { groupBlocks } from '../src/lib/blocks.js';

describe('groupBlocks', () => {
  it('wraps head + consecutive prayers into a group, exactly that run', () => {
    const blocks = [
      { t: 'head', text: 'ლოცვები' },
      { t: 'prayer', text: 'ა' },
      { t: 'prayer', text: 'ბ' },
      { t: 'rubric', text: 'განგება' },
      { t: 'head', text: 'სხვა' },
      { t: 'say', role: 'choir', who: 'გუნდი', text: 'უფალო' },
    ];
    const items = groupBlocks(blocks);
    expect(items[0]).toEqual({ group: true, head: blocks[0], i: 0, blocks: [blocks[1], blocks[2]], start: 1 });
    expect(items[1]).toEqual({ group: false, block: blocks[3], i: 3 });
    // head NOT followed by prayer stays a plain block
    expect(items[2]).toEqual({ group: false, block: blocks[4], i: 4 });
    expect(items[3]).toEqual({ group: false, block: blocks[5], i: 5 });
  });
});
```

- [ ] **Step 2: Run to verify both fail** — `npx vitest run tests/fmt.test.js tests/blocks.test.js`

- [ ] **Step 3: Implement**

`src/lib/fmt.js`:
```js
export const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// inline emphasis: *word* in the source markdown -> <em>
export const fmt = (s) => esc(s).replace(/\*([^*\n]{1,120}?)\*/g, '<em>$1</em>');
```

`src/lib/blocks.js`:
```js
// Collapsible prayer groups. Strict rule (ported from the old app): a heading
// followed IMMEDIATELY by one or more consecutive prayer blocks becomes a
// group covering exactly that run. Anything else in between breaks the group,
// so block order is never changed — only wrapped.
export function groupBlocks(blocks) {
  const items = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.t === 'head' && i + 1 < blocks.length && blocks[i + 1].t === 'prayer') {
      let j = i + 1;
      while (j < blocks.length && blocks[j].t === 'prayer') j++;
      items.push({ group: true, head: b, i, blocks: blocks.slice(i + 1, j), start: i + 1 });
      i = j - 1;
    } else {
      items.push({ group: false, block: b, i });
    }
  }
  return items;
}
```

- [ ] **Step 4: Run to verify pass**, then commit:

```bash
git add src/lib/fmt.js src/lib/blocks.js tests/fmt.test.js tests/blocks.test.js
git commit -m "feat: text formatting and prayer-group helpers"
```

### Task 9: Block component

**Files:**
- Create: `src/components/Block.svelte`
- Modify: `src/lib/roles.js` (add icons — still pre-Phase-5 stub otherwise)

- [ ] **Step 1: Add role icons to `src/lib/roles.js`** (ported from old app; stroke = role color via currentColor)

```js
export function roleName(id) { return id; } // replaced in Task 13

export const ROLE_ICONS = {
  bishop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5v19M8.5 6h7M6.5 10h11M8.5 13l7 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>',
  priest: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5v17M7 9h10" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" fill="none"/></svg>',
  deacon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="16" r="3.8" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M12 12.2V8.5M12 8.5 8.8 4.2M12 8.5l3.2-4.3M9 4h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>',
  choir: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="17.5" r="2.4" fill="currentColor"/><circle cx="16.5" cy="15.8" r="2.4" fill="currentColor"/><path d="M10.4 17.5V7.2l8.5-2v10.6M10.4 9.4l8.5-2" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>',
  reader: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.3C10.2 5 7.8 4.4 4.8 4.6V18c3-.2 5.4.4 7.2 1.7 1.8-1.3 4.2-1.9 7.2-1.7V4.6c-3-.2-5.4.4-7.2 1.7Zm0 0v13.4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/></svg>',
};
```

- [ ] **Step 2: Write `src/components/Block.svelte`**

```svelte
<script>
  import { fmt } from '../lib/fmt.js';
  import { ROLE_ICONS } from '../lib/roles.js';

  // mine/cue wired in Phase 5; dropcap in Phase 6 — props exist from day one
  let { block, i, mine = false, cue = false, dropcap = false } = $props();
</script>

{#if block.t === 'say'}
  <div class="blk say role-{block.role}" class:mine class:cue class:dropcap data-i={i}>
    <span class="who">{@html ROLE_ICONS[block.role] || ''}<span>{block.who}</span>{#if mine}<i class="you">შენ</i>{/if}</span>
    <p>{@html fmt(block.text)}</p>
    {#if cue}<span class="cue-mark" title="შემდეგი — შენი სტრიქონი">●</span>{/if}
  </div>
{:else if block.t === 'rubric'}
  <div class="blk rubric" class:cue data-i={i}>{@html fmt(block.text)}{#if cue}<span class="cue-mark">●</span>{/if}</div>
{:else if block.t === 'text'}
  <div class="blk text" class:cue class:dropcap data-i={i}>{@html fmt(block.text)}{#if cue}<span class="cue-mark">●</span>{/if}</div>
{:else if block.t === 'prayer'}
  <div class="blk prayer" class:cue class:dropcap data-i={i}>{@html fmt(block.text)}{#if cue}<span class="cue-mark">●</span>{/if}</div>
{:else if block.t === 'head'}
  <h2 class="head" data-i={i}>{block.text}</h2>
{:else if block.t === 'sep'}
  <div class="sep" data-i={i} aria-hidden="true">⁘</div>
{/if}

<style>
  .blk { position: relative; margin-bottom: calc(15px * var(--fs)); font-size: calc(16.5px * var(--fs)); }
  .say .who { display: flex; align-items: center; gap: 6px; font-size: calc(11.5px * var(--fs)); letter-spacing: .12em; text-transform: uppercase; font-weight: 700; margin-bottom: 3px; }
  .say .who :global(svg) { width: calc(15px * var(--fs)); height: calc(15px * var(--fs)); flex-shrink: 0; }
  .role-bishop .who { color: var(--c-bishop); }
  .role-priest .who { color: var(--c-priest); }
  .role-deacon .who { color: var(--c-deacon); }
  .role-choir .who { color: var(--c-choir); }
  .role-reader .who { color: var(--c-reader); }
  .rubric { color: var(--accent); opacity: .88; font-style: italic; font-size: calc(14px * var(--fs)); }
  .prayer { font-weight: 600; }
  .head { color: var(--accent); font-size: calc(15px * var(--fs)); letter-spacing: .06em; margin: calc(26px * var(--fs)) 0 calc(12px * var(--fs)); text-align: center; }
  .sep { text-align: center; color: var(--muted); margin: 18px 0; }
  .you { font-style: normal; font-size: 10px; background: var(--accent); color: var(--bg); border-radius: 6px; padding: 1px 6px; margin-left: 2px; }
  .mine { background: var(--accent-soft); box-shadow: inset 3px 0 0 var(--accent); border-radius: 8px; padding: 9px 11px; margin-left: -11px; margin-right: -11px; }
  .cue-mark { position: absolute; right: -2px; bottom: 2px; color: var(--accent); font-size: 9px; opacity: .8; }
  .dropcap > :global(p)::first-letter, .text.dropcap::first-letter, .prayer.dropcap::first-letter {
    float: left; font-size: 3.1em; line-height: .82; color: var(--accent); padding: .04em .08em 0 0; font-weight: 600;
  }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: Block component — all block types in vellum styling"
```

### Task 10: Reader view — core structure

**Files:**
- Create: `src/views/Reader.svelte`, `src/components/TocSheet.svelte`, `src/lib/wake.js`
- Modify: `src/App.svelte`

This is the largest task. It ports the old reader's behaviors **exactly** (inner scroll container, restore corrector, teardown guards — see comments). Reference: old `app/app.js` lines 214–594 in git history (`git show main:app/app.js`).

- [ ] **Step 1: Write `src/lib/wake.js`**

```js
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
```

- [ ] **Step 2: Write `src/components/TocSheet.svelte`**

```svelte
<script>
  import { fontScale, showRubrics, wakeWanted } from '../lib/store.js';
  import { setWake } from '../lib/wake.js';

  let { toc = [], currentI = 0, onGo, onClose, onPickRole } = $props();

  function fontStep(d) {
    fontScale.update((f) => Math.min(1.7, Math.max(0.8, +(f + d).toFixed(2))));
  }
  function toggleWake() {
    wakeWanted.update((w) => { setWake(!w); return !w; });
  }
  // current section = last toc anchor at or before currentI
  const curAnchor = $derived.by(() => {
    let cur = toc[0]?.i ?? 0;
    for (const t of toc) { if (t.i <= currentI) cur = t.i; else break; }
    return cur;
  });
</script>

<button class="scrim" onclick={onClose} aria-label="დახურვა"></button>
<div class="sheet" role="dialog" aria-label="სარჩევი და პარამეტრები">
  <div class="grip"></div>
  <div class="controls">
    <div class="ctl"><button onclick={() => fontStep(-0.1)}>A−</button><button onclick={() => fontStep(0.1)}>A+</button></div>
    <button class="ctl one" class:on={$showRubrics} onclick={() => showRubrics.update((r) => !r)}>განგება</button>
    <button class="ctl one" class:on={$wakeWanted} onclick={toggleWake}>⏾ ეკრანი</button>
    <button class="ctl one" onclick={onPickRole}>როლი</button>
  </div>
  <nav class="toc">
    {#each toc as t, n (t.i)}
      <button class:cur={t.i === curAnchor} onclick={() => onGo(t.i)}>
        <span class="n">{n + 1}</span>{t.text}
      </button>
    {/each}
  </nav>
</div>

<style>
  .scrim { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 40; width: 100%; }
  .sheet { position: fixed; left: 0; right: 0; bottom: 0; max-height: 72vh; display: flex; flex-direction: column; background: var(--bg-sheet); border-radius: 18px 18px 0 0; z-index: 41; padding: 8px 16px calc(14px + env(safe-area-inset-bottom)); box-shadow: var(--shadow); }
  .grip { width: 38px; height: 4px; border-radius: 2px; background: var(--line); margin: 4px auto 12px; }
  .controls { display: flex; gap: 8px; margin-bottom: 12px; }
  .ctl { display: flex; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
  .ctl button, .ctl.one { padding: 8px 12px; font-size: 13.5px; font-weight: 600; }
  .ctl.one.on { color: var(--accent); border-color: var(--accent); }
  .toc { overflow-y: auto; }
  .toc button { display: flex; gap: 10px; align-items: baseline; width: 100%; text-align: left; padding: 9px 6px; border-bottom: 1px solid var(--line); font-size: 14.5px; }
  .toc button.cur { color: var(--accent); font-weight: 700; }
  .toc .n { color: var(--muted); font-size: 11px; min-width: 16px; }
</style>
```

- [ ] **Step 3: Write `src/views/Reader.svelte`**

```svelte
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
```

`RoleSheet` and `FollowBar` don't exist yet — create minimal placeholder files so this compiles (replaced in Tasks 17–18):

`src/components/RoleSheet.svelte`:
```svelte
<script> let { onClose } = $props(); </script>
<button class="scrim" onclick={onClose} aria-label="დახურვა" style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:40;width:100%"></button>
```

`src/components/FollowBar.svelte`:
```svelte
<script> let { sectionName, pos, total, onPrev, onNext } = $props(); </script>
<div>{sectionName} · {pos}/{total}</div>
```

- [ ] **Step 4: Wire Reader into App.svelte** — replace the reader placeholder branch with `<Reader id={route.id} block={route.block} />`, and add `{#key route.id}` around it so navigating between texts remounts cleanly:

```svelte
{#key route.view + ':' + (route.id || '')}
  {#if route.view === 'home'}
    <Home />
  {:else if route.view === 'category'}
    <Category id={route.id} />
  {:else}
    <Reader id={route.id} block={route.block} />
  {/if}
{/key}
```

- [ ] **Step 5: Verify in dev server (this is the big checkpoint)**

`npm run dev`, then check: open მწუხრი — blocks render with role colors, rubrics in red italic; TOC sheet opens, jumps work; font A−/A+ persists; rubrics toggle hides rubrics; scroll position survives reload; auto-scroll runs with speed pill; "შემდეგი მსახურება" chains to ცისკარი; `#/t/liturgy?b=100` lands at block 100 with a flash; vitest still green.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: reader view — blocks, TOC, settings, positions, auto-scroll, swipe back"
```

**PHASE 3 CHECKPOINT — report to user:** reading experience at parity with old app, in new design.

---

## Phase 4 — Search

### Task 11: Search matching (TDD)

**Files:**
- Create: `src/lib/search.js`, `tests/search.test.js`

- [ ] **Step 1: Write the failing test `tests/search.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { normalize, searchIndex } from '../src/lib/search.js';

const IDX = [
  { id: 'vespers', name: 'მწუხრი', entries: [
    [3, 'დიდი კვერექსი', 'დიაკონი: მშვიდობით უფლისა მიმართ ვილოცოთ.'],
    [4, 'დიდი კვერექსი', 'გუნდი: უფალო, შეგვიწყალენ.'],
  ]},
  { id: 'liturgy', name: 'ლიტურგია', entries: [
    [10, 'ანტიფონები', 'გუნდი: უფალო, შეგვიწყალენ, შეგვიწყალენ.'],
  ]},
];

describe('normalize', () => {
  it('strips punctuation and collapses whitespace', () => {
    expect(normalize('უფალო,  შეგვიწყალენ.')).toBe('უფალო შეგვიწყალენ');
  });
  it('lowercases latin', () => {
    expect(normalize('Amen!')).toBe('amen');
  });
});

describe('searchIndex', () => {
  it('finds matches across texts with section context', () => {
    const r = searchIndex(IDX, 'უფალო შეგვიწყალენ');
    expect(r.length).toBe(2);
    expect(r[0]).toMatchObject({ id: 'vespers', name: 'მწუხრი', i: 4, section: 'დიდი კვერექსი' });
    expect(r[1]).toMatchObject({ id: 'liturgy', i: 10 });
  });
  it('ignores queries shorter than 2 chars', () => {
    expect(searchIndex(IDX, 'უ')).toEqual([]);
  });
  it('matches despite punctuation differences', () => {
    expect(searchIndex(IDX, 'ვილოცოთ').length).toBe(1);
  });
  it('caps results at the limit', () => {
    expect(searchIndex(IDX, 'უფალო', 1).length).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**, then write `src/lib/search.js`:

```js
// Georgian-aware text normalization: Georgian has no case, but titles may
// contain Latin; punctuation differs between query and source.
export function normalize(s) {
  return s.toLowerCase()
    .replace(/[„""''«»,.;:!?()\[\]—–\-_*·~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Linear scan over the prebuilt index — at hundreds of texts this is a few
// hundred KB of strings, fine on-device. entries: [blockIndex, section, text].
export function searchIndex(index, query, limit = 60) {
  const q = normalize(query);
  if (q.length < 2) return [];
  const out = [];
  for (const text of index) {
    for (const [i, section, body] of text.entries) {
      if (normalize(body).includes(q)) {
        out.push({ id: text.id, name: text.name, i, section, body });
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}
```

- [ ] **Step 3: Run to verify pass**, commit:

```bash
git add src/lib/search.js tests/search.test.js
git commit -m "feat: client-side full-text search over prebuilt index"
```

### Task 12: Search overlay UI

**Files:**
- Create: `src/components/SearchOverlay.svelte`
- Modify: `src/views/Home.svelte`, `src/views/Category.svelte`

- [ ] **Step 1: Write `src/components/SearchOverlay.svelte`**

```svelte
<script>
  import { loadSearchIndex } from '../lib/data.js';
  import { searchIndex } from '../lib/search.js';

  let { onClose } = $props();
  let query = $state('');
  let idx = $state(null);
  let input;

  loadSearchIndex().then((i) => { idx = i; });
  $effect(() => { input && input.focus(); });

  const results = $derived(idx && query ? searchIndex(idx, query) : []);
  // group consecutive results by text for display
  const grouped = $derived.by(() => {
    const g = [];
    for (const r of results) {
      const last = g[g.length - 1];
      if (last && last.id === r.id) last.hits.push(r);
      else g.push({ id: r.id, name: r.name, hits: [r] });
    }
    return g;
  });

  function snippet(body) {
    const at = body.toLowerCase().indexOf(query.trim().toLowerCase());
    if (at === -1) return body.length > 120 ? body.slice(0, 120) + '…' : body;
    const start = Math.max(0, at - 40);
    const s = (start ? '…' : '') + body.slice(start, at + query.length + 60);
    return s.length < body.length - start ? s + '…' : s;
  }

  function go(r) {
    onClose();
    location.hash = `#/t/${r.id}?b=${r.i}`;
  }
</script>

<div class="overlay" role="dialog" aria-label="ძიება">
  <header class="bar">
    <input bind:this={input} bind:value={query} placeholder="ძიება ყველა ტექსტში…"
      type="search" enterkeyhint="search" />
    <button class="close" onclick={onClose}>დახურვა</button>
  </header>
  <div class="results">
    {#if query.trim().length >= 2 && idx}
      {#if grouped.length === 0}
        <p class="empty">ვერაფერი მოიძებნა</p>
      {/if}
      {#each grouped as g (g.id)}
        <h3>{g.name}</h3>
        {#each g.hits as r (r.i)}
          <button class="hit" onclick={() => go(r)}>
            <span class="sec">{r.section}</span>
            <span class="body">{snippet(r.body)}</span>
          </button>
        {/each}
      {/each}
    {/if}
  </div>
</div>

<style>
  .overlay { position: fixed; inset: 0; z-index: 60; background: var(--bg); display: flex; flex-direction: column; }
  .bar { display: flex; gap: 8px; padding: calc(10px + env(safe-area-inset-top)) 14px 10px; border-bottom: 1px solid var(--line); }
  input { flex: 1; font: inherit; font-size: 15px; color: var(--ink); background: var(--bg-sheet); border: 1px solid var(--line); border-radius: 10px; padding: 9px 12px; outline: none; }
  input:focus { border-color: var(--accent); }
  .close { color: var(--accent); font-size: 13.5px; font-weight: 600; }
  .results { flex: 1; overflow-y: auto; padding: 10px 14px 30px; max-width: 560px; margin: 0 auto; width: 100%; }
  h3 { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin: 16px 0 6px; }
  .hit { display: block; width: 100%; text-align: left; background: var(--bg-sheet); border: 1px solid var(--line); border-radius: 10px; padding: 9px 12px; margin-bottom: 7px; }
  .sec { display: block; font-size: 10.5px; color: var(--accent); font-weight: 700; }
  .body { font-size: 13.5px; color: var(--ink-soft); }
  .empty { color: var(--muted); text-align: center; padding: 30px 0; }
</style>
```

- [ ] **Step 2: Add the search field to `Home.svelte`** — below the tagline:

```svelte
  import SearchOverlay from '../components/SearchOverlay.svelte';
  let searchOpen = $state(false);
  ...
  <button class="srch" onclick={() => { searchOpen = true; }}>⌕ ძიება ყველა ტექსტში…</button>
  ...
  {#if searchOpen}<SearchOverlay onClose={() => { searchOpen = false; }} />{/if}
```
with style:
```css
  .srch { display: block; width: 100%; text-align: left; background: var(--bg-sheet); border: 1px solid var(--line); border-radius: 10px; padding: 10px 13px; color: var(--muted); font-size: 14px; margin-bottom: 16px; }
```

- [ ] **Step 3: Add a ⌕ button to `Category.svelte`'s top bar** that opens the same overlay (same pattern: `searchOpen` state + component).

- [ ] **Step 4: Verify** — dev server: search "უფალო შეგვიწყალენ" returns grouped hits; tapping one opens the reader at the right block with a 2s flash; works offline (`npm run build && npm run preview`, devtools offline). Run `npx vitest run` — green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: search overlay with deep links into reader blocks"
```

**PHASE 4 CHECKPOINT — report to user:** any text findable by content in ≤3 taps.

---

## Phase 5 — Role system

### Task 13: Role marks (TDD)

**Files:**
- Modify: `src/lib/roles.js` (replace stub `roleName`, add `ROLES`, `roleMarks`)
- Create: `tests/roles.test.js`

- [ ] **Step 1: Write the failing test `tests/roles.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { ROLES, roleName, roleMarks } from '../src/lib/roles.js';

describe('ROLES', () => {
  it('lists the five serving roles', () => {
    expect(ROLES.map((r) => r.id)).toEqual(['bishop', 'priest', 'deacon', 'reader', 'choir']);
  });
  it('roleName resolves Georgian names', () => {
    expect(roleName('choir')).toBe('გუნდი');
    expect(roleName('bishop')).toBe('მღვდელმთავარი');
  });
});

describe('roleMarks', () => {
  const blocks = [
    { t: 'say', role: 'deacon', who: 'დიაკონი', text: 'ა' },   // 0
    { t: 'say', role: 'choir', who: 'გუნდი', text: 'ბ' },      // 1 mine
    { t: 'rubric', text: 'განგება' },                            // 2
    { t: 'sep' },                                                 // 3
    { t: 'say', role: 'choir', who: 'გუნდი', text: 'გ' },      // 4 mine — cue skips sep
    { t: 'say', role: 'choir', who: 'გუნდი', text: 'დ' },      // 5 mine — prev is mine, no cue
  ];
  it('marks my blocks and the block immediately before each (skipping seps)', () => {
    const { mine, cue } = roleMarks(blocks, 'choir');
    expect([...mine].sort()).toEqual([1, 4, 5]);
    expect([...cue].sort()).toEqual([0, 2]);
  });
  it('no role → nothing marked', () => {
    const { mine, cue } = roleMarks(blocks, null);
    expect(mine.size).toBe(0);
    expect(cue.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**, then replace `roleName` in `src/lib/roles.js` (keep `ROLE_ICONS`):

```js
export const ROLES = [
  { id: 'bishop', name: 'მღვდელმთავარი' },
  { id: 'priest', name: 'მღვდელი' },
  { id: 'deacon', name: 'დიაკონი' },
  { id: 'reader', name: 'მკითხველი' },
  { id: 'choir', name: 'გუნდი' },
];

export function roleName(id) {
  const r = ROLES.find((x) => x.id === id);
  return r ? r.name : '';
}

// mine: indices of blocks spoken by `role`. cue: the nearest non-separator
// block before each run of mine — "your entrance is next."
export function roleMarks(blocks, role) {
  const mine = new Set(), cue = new Set();
  if (!role) return { mine, cue };
  blocks.forEach((b, i) => { if (b.t === 'say' && b.role === role) mine.add(i); });
  for (const i of mine) {
    for (let j = i - 1; j >= 0; j--) {
      if (blocks[j].t === 'sep') continue;
      if (!mine.has(j)) cue.add(j);
      break;
    }
  }
  return { mine, cue };
}
```

- [ ] **Step 3: Run to verify pass**, commit:

```bash
git add src/lib/roles.js tests/roles.test.js
git commit -m "feat: role list and highlight/cue computation"
```

### Task 14: Role sheet + badge wiring

**Files:**
- Replace: `src/components/RoleSheet.svelte` (placeholder from Task 10)
- Modify: `src/views/Home.svelte`

- [ ] **Step 1: Write the real `src/components/RoleSheet.svelte`**

```svelte
<script>
  import { role } from '../lib/store.js';
  import { ROLES, ROLE_ICONS } from '../lib/roles.js';

  let { onClose } = $props();
  function pick(id) { role.set(id); onClose(); }
</script>

<button class="scrim" onclick={onClose} aria-label="დახურვა"></button>
<div class="sheet" role="dialog" aria-label="როლის არჩევა">
  <div class="grip"></div>
  <h3>ვინ ხართ მსახურებაზე?</h3>
  <p class="note">თქვენი სტრიქონები გამოიკვეთება — არაფერი იმალება</p>
  {#each ROLES as r (r.id)}
    <button class="opt role-{r.id}" class:cur={$role === r.id} onclick={() => pick(r.id)}>
      <span class="ic">{@html ROLE_ICONS[r.id]}</span>{r.name}
      {#if $role === r.id}<span class="chk">✓</span>{/if}
    </button>
  {/each}
  <button class="opt" class:cur={$role === null} onclick={() => pick(null)}>
    მლოცველი — როლის გარეშე
    {#if $role === null}<span class="chk">✓</span>{/if}
  </button>
</div>

<style>
  .scrim { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 50; width: 100%; }
  .sheet { position: fixed; left: 0; right: 0; bottom: 0; background: var(--bg-sheet); border-radius: 18px 18px 0 0; z-index: 51; padding: 8px 18px calc(18px + env(safe-area-inset-bottom)); box-shadow: var(--shadow); }
  .grip { width: 38px; height: 4px; border-radius: 2px; background: var(--line); margin: 4px auto 12px; }
  h3 { font-size: 16px; }
  .note { color: var(--muted); font-size: 12.5px; margin: 2px 0 12px; }
  .opt { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 11px 8px; border-bottom: 1px solid var(--line); font-size: 15px; font-weight: 600; }
  .opt .ic { display: inline-flex; }
  .opt .ic :global(svg) { width: 18px; height: 18px; }
  .role-bishop .ic { color: var(--c-bishop); }
  .role-priest .ic { color: var(--c-priest); }
  .role-deacon .ic { color: var(--c-deacon); }
  .role-reader .ic { color: var(--c-reader); }
  .role-choir .ic { color: var(--c-choir); }
  .opt .chk { margin-left: auto; color: var(--accent); }
  .opt.cur { color: var(--accent); }
</style>
```

- [ ] **Step 2: Wire into Home** — import RoleSheet; render `{#if roleSheetOpen}<RoleSheet onClose={() => { roleSheetOpen = false; }} />{/if}` (the badge's onclick already sets `roleSheetOpen = true` from Task 6).

- [ ] **Step 3: Verify** — pick გუნდი on home: badge shows გუნდი; open ლიტურგია: choir lines highlighted with left bar + "შენ" tag, blocks before them carry the cue dot; switch to მლოცველი: highlights gone. Role survives reload. (Reader's TocSheet "როლი" button already opens the sheet from Task 10's wiring.)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: role picker sheet; highlight + cue wiring live"
```

**PHASE 5 CHECKPOINT — report to user:** role-aware reading works end-to-end.

---

## Phase 6 — Follow mode, smoke tests, cutover polish

### Task 15: Follow bar (the real one)

**Files:**
- Replace: `src/components/FollowBar.svelte`

- [ ] **Step 1: Write the real `src/components/FollowBar.svelte`** (layout A from the approved mockup)

```svelte
<script>
  let { sectionName, pos, total, onPrev, onNext } = $props();
</script>

<div class="fbar">
  <button class="step" onclick={onPrev} disabled={pos <= 1} aria-label="წინა სექცია">‹</button>
  <div class="mid">
    <span class="count">{pos}/{total}</span>
    <span class="name">{sectionName}</span>
  </div>
  <button class="step" onclick={onNext} disabled={pos >= total} aria-label="შემდეგი სექცია">›</button>
</div>

<style>
  .fbar { display: flex; align-items: center; gap: 10px; padding: 8px 12px calc(10px + env(safe-area-inset-bottom)); border-top: 1px solid var(--line); background: var(--bg-raise); }
  .step { font-size: 24px; line-height: 1; color: var(--c-deacon); padding: 8px 20px; border: 1px solid var(--line); border-radius: 12px; min-width: 64px; }
  .step:disabled { opacity: .3; }
  .mid { flex: 1; text-align: center; min-width: 0; }
  .count { display: block; font-size: 11px; color: var(--muted); }
  .name { display: block; font-size: 13.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
```

- [ ] **Step 2: Verify** — enter follow mode (👁︎): topbar collapses to ✕ chip + wake dot, bottom stepper appears, ‹ › jump TOC sections, text grows ~10%, screen-wake forced; exit returns the full chrome at the same scroll position; auto-scroll still usable inside follow mode.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: follow mode — distraction-free state with section stepper"
```

### Task 16: Playwright smoke suite

**Files:**
- Create: `playwright.config.js`, `tests/e2e/smoke.spec.js`
- Modify: `package.json` (add script)

- [ ] **Step 1: Install**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Write `playwright.config.js`**

```js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  use: { ...devices['iPhone 13'] },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
```

- [ ] **Step 3: Write `tests/e2e/smoke.spec.js`**

```js
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:4173/';

test('home → category → reader', async ({ page }) => {
  await page.goto(BASE);
  await expect(page.getByRole('heading', { name: 'მეუფის კონდაკი' })).toBeVisible();
  await page.getByText('განგებანი').click();
  await page.getByText('მცირე პარაკლისი').click();
  await expect(page.locator('.reader .blk').first()).toBeVisible();
});

test('legacy URL redirects into reader', async ({ page }) => {
  await page.goto(BASE + '#/vespers');
  await expect(page).toHaveURL(/#\/t\/vespers/);
  await expect(page.locator('.reader')).toBeVisible();
});

test('search deep-links to a block', async ({ page }) => {
  await page.goto(BASE);
  await page.getByText('ძიება ყველა ტექსტში').click();
  await page.getByPlaceholder('ძიება ყველა ტექსტში…').fill('მშვიდობით უფლისა მიმართ');
  await page.locator('.hit').first().click();
  await expect(page).toHaveURL(/#\/t\/.+\?b=\d+/);
  await expect(page.locator('.flash')).toBeVisible();
});

test('role highlight appears after picking choir', async ({ page }) => {
  await page.goto(BASE);
  await page.getByRole('button', { name: 'როლის არჩევა' }).click();
  await page.getByRole('button', { name: 'გუნდი', exact: true }).click();
  await page.getByText('მწუხრი', { exact: true }).click();
  await expect(page.locator('.blk.mine').first()).toBeVisible();
});

test('follow mode shows stepper and steps sections', async ({ page }) => {
  await page.goto(BASE + '#/t/vespers');
  await page.getByRole('button', { name: 'თვალყურის დევნება' }).click();
  await expect(page.getByRole('button', { name: 'შემდეგი სექცია' })).toBeVisible();
  await page.getByRole('button', { name: 'შემდეგი სექცია' }).click();
  await page.getByRole('button', { name: /დასრულება/ }).click();
  await expect(page.getByRole('button', { name: 'სარჩევი' })).toBeVisible();
});

test('theme toggle persists', async ({ page }) => {
  await page.goto(BASE);
  const before = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.getByRole('button', { name: 'თემა' }).or(page.getByRole('button', { name: 'თემა', exact: false })).first().click();
  await page.reload();
  const after = await page.evaluate(() => document.documentElement.dataset.theme);
  expect(after).not.toBe(before);
});
```

- [ ] **Step 4: Add script** to package.json: `"e2e": "playwright test"`.

- [ ] **Step 5: Run and fix until green**

Run: `npm run e2e` — Expected: 6 passed. If a selector fails, fix the selector or the missing aria-label in the component (the labels above match the components as written in earlier tasks).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: Playwright smoke suite for core flows"
```

### Task 17: PWA / offline / upgrade verification + redesign notes

**Files:**
- Create: `REDESIGN_NOTES.md`
- Modify: `README.md` (run/build instructions)

- [ ] **Step 1: Offline verification (manual, document results)**

```bash
npm run build && npm run preview
```
In a browser at http://localhost:4173: load home, wait for SW install (devtools → Application → Service Workers shows activated `sw.js`); set devtools Network → Offline; reload — home loads; open a text never visited — it loads (precached); search works offline. Record pass/fail in REDESIGN_NOTES.md.

- [ ] **Step 2: Upgrade-path verification (manual)**

Simulates an installed old-app client: `git stash && git checkout main`, `python3 -m http.server 4173 -d app` … visit, let old SW install, stop server; `git checkout feature/redesign && git stash pop`, `npm run preview` on the same port, reload twice — new app takes over, no `kondaki-*` caches remain (devtools → Application → Cache Storage), `mk:pos:*` positions still honored. Record results.

- [ ] **Step 3: Write `REDESIGN_NOTES.md`** — the user-facing review document. Structure (fill with actuals, including before/after screenshots if convenient):

```markdown
# Redesign summary (feature/redesign)

## What changed, by screen
### Home  — before / after / why
### Category pages — new screen, why
### Reader — before / after / why
### Search — new, how it works
### Role views — new, how it works
### Follow mode — new, what it does

## Non-obvious UX decisions (before/after)
- Role = highlight, never filter — why
- Rubric red + drop caps — why
- Follow mode visible stepper vs invisible edge taps — why
- Pinned services vs pure category hub — why
- Search index built at build time — why

## Technical migration notes
- Svelte 5 + Vite + Workbox; old SW cutover behavior
- localStorage compatibility (positions/settings preserved)
- Verification results (offline, upgrade path, vitest, e2e)
```

- [ ] **Step 4: Update `README.md`** — replace the `გაშვება` (run) section: dev = `npm install && npm run dev`; build = `npm run build` → `dist/`; structure section: `src/` app, `public/` static, `build.cjs` data pipeline.

- [ ] **Step 5: Full verification sweep**

```bash
npx vitest run && npm run e2e && npm run build
```
Expected: all green, build succeeds.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "docs: redesign notes, README update, offline/upgrade verification"
```

**FINAL CHECKPOINT — report to user:** full feature set done; hand over REDESIGN_NOTES.md; remind that merge is manual.

---

## Self-review notes (already applied)

- Spec coverage: role badge on Home (Task 6) is inert until Task 14 — acceptable, noted in both tasks. TocSheet's "როლი" button wired in Task 10, functional once Task 14 replaces the placeholder sheet.
- Drop caps land via Block's `dropcap` prop (Task 9) computed in Reader (Task 10) — spec §4 covered in Phase 3, not Phase 6; Task 15's "polish" is therefore only the FollowBar.
- `groupBlocks` keying: `{#each items as item (item.i)}` is stable because group items carry the head's index.
- Old `group` field dropped from index.json: safe — old clients only ever read the SW-cached copy until the new SW reloads them into the new app.
