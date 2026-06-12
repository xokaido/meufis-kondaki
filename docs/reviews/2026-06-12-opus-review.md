# Full Application Review

Date: 2026-06-12
Scope: entire repository at `main` (`fc6c641`) — runtime app, data pipeline,
PWA/service worker, tests, CI/deploy, content sources, docs.

## Verification performed

- `npm run check`: 0 errors, 0 warnings (svelte-check, 9 files)
- `npm test`: 89 tests green (8 files), `npm run e2e`: 12 green
- `npm run build`: clean, no warnings; generated data byte-stable
- `npm audit --audit-level=low`: 0 vulnerabilities
- Built-bundle inspection: `dist/assets/index-*.js` 78.6 KB (pre-gzip),
  CSS 15.8 KB, workbox-window chunk 5.6 KB, data 1.3 MB
  (search index 680 KB), precache 25 entries, no duplicates
- Source line counts: 1,487 lines total across `src/` + `build.cjs` —
  small, dependency-free runtime (zero production npm dependencies)

Everything previously flagged in `docs/reviews/2026-06-12-review.md` is
fixed and verified. The findings below are **new** suggestions.

---

## High impact (user-visible)

### H1 — Dark-theme flash on every cold start

`src/styles/tokens.css` makes `:root` the **light** parchment theme;
dark is applied only when `App.svelte`'s `$effect` sets
`data-theme="dark"` — i.e. after JS loads and Svelte mounts. A
dark-theme user (arguably the typical case: dim church, evening
services) gets a bright parchment flash on every launch. The old app
was dark-first, so this is a quiet regression of initial paint.

**Fix:** a tiny inline script in `index.html` `<head>`, before the CSS
loads, so the correct theme paints first:

```html
<script>
  try {
    var t = JSON.parse(localStorage.getItem('mk:theme'))
      || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.dataset.theme = t;
    document.querySelector('meta[name=theme-color]').content =
      t === 'light' ? '#f6efdd' : '#191310';
  } catch (e) {}
</script>
```

Also add a `background:` to `html` in `tokens.css` keyed off
`data-theme` so even the pre-CSS-paint frame is right. The static
`<meta name="theme-color" content="#191310">` currently disagrees with
the light theme until the effect runs — the same script fixes that.

### H2 — Auto-update reloads the page at an uncontrolled moment

`registerType: 'autoUpdate'` + `registerSW({ immediate: true })`
means: when a deploy lands while someone has the app open, the new
service worker activates and **the page reloads immediately**
(confirmed in the built bundle: `activated` → `window.location.reload()`).
Position restore makes this nearly invisible while reading — but it
can fire mid-search, mid-follow-mode (exits follow state), or mid-TOC
interaction. For an app used *during live services*, an
update-triggered reload at the wrong second is the worst-case UX.

**Options, in order of preference:**
1. Switch to `registerType: 'prompt'` and apply the update on the
   *next navigation to home* (or show a quiet "განახლება ხელმისაწვდომია"
   chip on the home screen). Updates still arrive promptly; they just
   never interrupt a service.
2. Keep autoUpdate but persist follow-mode/search state across reload
   so interruption cost is ~0.
3. Keep as-is, but make it a documented, deliberate choice.

### H3 — Stale document title outside the reader

Only `Reader.svelte` sets `document.title`. After visiting მწუხრი and
returning home, the tab/app-switcher still says "მწუხრი · მეუფის კონდაკი".
Category pages never set a title at all.

**Fix:** own the title in `App.svelte`, derived from the route (home →
app name, category → category name, reader → keep current behavior),
so it can never go stale. ~6 lines.

---

## Medium impact

### M1 — Search re-normalizes the entire index on every keystroke

`searchIndex()` calls `normalize(body)` on **every entry per
keystroke** (~1,700 entries today). Fine now (a few ms), but it's the
one algorithm in the app that degrades linearly with library growth —
and the spec's ambition is hundreds of texts. There's also no input
debounce, so it runs per character.

**Fix (keeps the index file size unchanged):** normalize once, lazily,
on first search — cache `entry[3] = normalize(body)` in memory — then
each keystroke is a plain `.includes()` over cached strings. Add a
~80 ms debounce in `SearchOverlay` when the index passes ~5k entries.
Alternative: emit pre-normalized text from `build.cjs` (costs ~2× file
size; not worth it yet).

### M2 — `Reader.svelte` is becoming the god-file (389 lines)

It currently contains: data loading, scroll mechanics, the position
restore corrector, the auto-scroll engine, the swipe-back gesture
recognizer, follow-mode state, TOC/role-sheet orchestration, and the
template. The mount `$effect` alone is ~95 lines wrapped in
`untrack()`. Each piece is correct, but the next person touching
auto-scroll has to scroll past the gesture recognizer to find it.

**Fix:** extract two Svelte actions + one module, all independently
testable: `lib/swipeback.js` (action: attach/teardown the gesture),
`lib/autoscroll.js` (engine with start/stop/speed), and move the
restore-corrector into `lib/restore.js`. Reader drops to ~200 lines of
orchestration; the `untrack()` wrapper can likely disappear because the
actions own their listeners.

### M3 — Orphaned localStorage keys accumulate

`mk:pos:<id>` keys are written per text and never cleaned. If a text
id is ever renamed or removed in `texts/`, stale keys linger forever
(and `mk:last` can point at a text that no longer exists — the
continue card handles that, but nothing sweeps). Not a bug today; it
becomes one the first time content is restructured.

**Fix:** on boot (after `loadIndex()`), enumerate `mk:pos:*` keys and
drop any whose id isn't in the index. ~8 lines in `store.js`.

### M4 — Dialog scrim sits outside the focus-trapped node

In `RoleSheet`/`TocSheet`, the `<button class="scrim">` is a *sibling*
of the `use:dialog` node. Consequences: the trap cycles within the
sheet but Tab from the scrim itself isn't governed, and the scrim (a
focusable, labeled button) lives outside the `aria-modal` element —
screen readers may announce it as content behind a modal, which is
contradictory.

**Fix:** wrap scrim + sheet in one container and put `use:dialog` on
the container (as Home's install guide already does), or give the
scrim `tabindex="-1"` (click/touch still works; Escape already covers
keyboard close).

### M5 — No security headers on the primary deployment

The app is static with no user input persisted to a server, so risk is
inherently low — but there is no CSP, and `{@html}` is used in 5
places (all currently safe via `fmt()` escaping + static icon
constants). Defense-in-depth is one file away on Cloudflare:

**Fix:** add `public/_headers`:

```
/*
  Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; manifest-src 'self'; worker-src 'self'
  X-Content-Type-Options: nosniff
  Referrer-Policy: same-origin
```

(`style-src 'unsafe-inline'` is required by the inline `style=`
attributes used for progress widths/font scale.) Verify against the
deployed site before trusting it — CSP typos break apps silently.

### M6 — The marquee feature (offline) has no automated test

The e2e suite covers every flow *except* the one the architecture
exists for. Playwright can do this: load page, wait for SW activation,
`context.setOffline(true)`, reload, open a never-visited text, search.
The 2026-06-12 review did it manually; manual checks rot.

**Fix:** one `tests/e2e/offline.spec.js` (~25 lines). Run it in CI —
Chromium there supports service workers.

### M7 — Legacy-URL load briefly renders the reader before redirecting

`App.svelte` initializes `route = $state(parseRoute(location.hash))`,
which for `#/vespers` returns a reader route *with* `redirect`; the
template renders the Reader for one tick before `onHash()` fires
`location.replace`. Flagged in the Task-10 review as cosmetic; still
true. **Fix:** resolve the redirect during initialization:

```js
const initial = parseRoute(location.hash);
if (initial.redirect) location.replace(initial.redirect);
let route = $state(initial.redirect ? { view: 'home' } : initial);
```

(One frame of home instead of a reader that immediately remounts.)

---

## Low impact / polish

### L1 — `prefers-reduced-motion` is not respected
Smooth scrolls (`behavior: 'smooth'`), the 2 s search-hit flash, sheet
slide-ins, and the swipe-back transform all animate unconditionally.
A `@media (prefers-reduced-motion: reduce)` block + a small
`prefersReduced` check before `behavior: 'smooth'` covers it.

### L2 — No social/share metadata
`index.html` has no `<meta name="description">`, no Open Graph/Twitter
tags. Shared links to gulani.ge render bare. Three meta tags + the
existing icon would fix it.

### L3 — Category page renders an empty header while index loads
`<h1>{cat ? cat.name : ''}</h1>` causes a visible title pop-in. Tiny
skeleton (or rendering nothing until `index` resolves, like Home
effectively does) removes the shift.

### L4 — `texts/` numbering convention is implicit
Files step by 10 (`10-…90-`) then break pattern at `95-kurtxevani`.
The gap convention (insert between neighbors without renaming) works,
but `texts/README.md` doesn't state it. One sentence: "numbers only
define order; leave gaps; renumbering is safe because ids, not
filenames, are the stable key."

### L5 — Section-attribution logic exists twice
`build.cjs#searchEntries.sectionFor` and `Reader.svelte#section`
implement the same "latest TOC anchor ≤ i" walk on either side of the
build/runtime boundary. Acceptable duplication (different languages of
data), but worth a cross-referencing comment so they evolve together.

### L6 — Test environment is jsdom for everything
Only `store.test.js` needs DOM globals; the other 7 suites are pure.
`environmentMatchGlobs` would shave startup, but at 826 ms total it's
genuinely optional.

### L7 — `engines` floor vs `.nvmrc` divergence
`package.json` allows `>=20.19.0`, `.nvmrc` pins 22, CI uses `.nvmrc`.
Coherent but mildly confusing; consider raising `engines` to `>=22`
once you're confident no contributor is on 20.

### L8 — Duplicate commit in history
`64eb7d6` and `24c0bc1` share a message (the first landed with a
failing assertion because a `grep` in a verification chain masked the
vitest exit code). No action — but verification chains should gate on
exit codes, not on grep finding summary lines.

---

## Positive findings (worth keeping deliberately)

- **Zero runtime dependencies** and 1,487 lines of source for the whole
  app: the strongest maintainability property the project has.
- The `texts/` frontmatter pipeline is the right shape: content
  contributors never touch code, the golden-data suite catches
  classification drift, and generated output is reproducible.
- Security posture of text rendering is sound: `fmt()` escapes before
  the only markup transform; role icons are static constants; the new
  search highlighting renders raw segments as text nodes, not HTML.
- The SW upgrade path (same `sw.js` filename, `kondaki-*` cache purge,
  `clientsClaim`) remains correct for installed clients.
- CI now actually gates deploys; the golden tests mean a markdown edit
  that silently reclassifies blocks fails the pipeline instead of
  shipping.
- `mk:` localStorage compatibility has survived two architecture
  changes — users have never lost a reading position.

## Suggested priority order

1. **H1** theme flash (small, every-launch impact, dark users)
2. **H2** update-reload policy (decide before the next mid-service deploy)
3. **H3** + **M7** title + redirect tick (trivial, same file)
4. **M6** offline e2e (protects the core promise in CI)
5. **M4** dialog scrim containment (finishes the a11y work properly)
6. **M3** localStorage sweep (before any content restructuring)
7. **M1** search normalization cache (before the library grows)
8. **M2** Reader decomposition (next time anyone touches Reader)
9. **M5** CSP headers (an afternoon, with careful verification)
10. L1–L7 opportunistically

---

## Disposition (2026-06-12, branch `fix/opus-review`)

| Finding | Status |
|---|---|
| H1 dark-theme flash | Fixed — `public/theme-init.js` applies theme pre-paint (external file, CSP-friendly) |
| H2 update reloads mid-service | Fixed — prompt-mode SW; refresh chip on home; untapped updates apply on next app restart |
| H3 stale titles | Fixed — App owns the home title; Category sets its own |
| M1 search re-normalization | Fixed — lazy per-index WeakMap cache of normalized entries |
| M2 Reader god-file | Fixed — autoscroll engine + swipeback action extracted (389→333 lines); swipe gets first e2e |
| M3 orphaned localStorage keys | Fixed — `sweepPositions()` on boot |
| M4 scrim outside focus trap | Fixed — scrims `tabindex=-1 aria-hidden`; trap filters them |
| M5 security headers | Fixed — `public/_headers` CSP verified violation-free in Chromium before ship |
| M6 offline untested | Fixed — `tests/e2e/offline.spec.js` (reload, unvisited text, search — all offline) |
| M7 redirect tick | Fixed — legacy redirect resolved at init |
| L1 reduced motion | Fixed — CSS media block + smooth-scroll gate |
| L2 share metadata | Fixed — description/OG/twitter tags |
| L3 category header pop-in | Fixed — nbsp placeholder |
| L4 numbering convention | Fixed — documented in texts/README.md |
| L5 duplicated section walk | Fixed — cross-referencing comments |
| L6 jsdom everywhere | Deliberately skipped — suite runs in <1s |
| L7 engines floor | Deliberately kept ≥20.19 — CI pins via .nvmrc |
| L8 duplicate commit | No action (history note) |
