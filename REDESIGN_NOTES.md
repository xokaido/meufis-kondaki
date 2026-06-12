# Redesign summary (feature/redesign)

Branch `feature/redesign` is a complete Svelte 5 + Vite rewrite of the app
previously in `app/` (vanilla JS, ~800 lines, hand-rolled service worker).
The public URL, SW path, and all user data survive the upgrade with no manual
migration.

---

## What changed, by screen

### Home — before / after / why

**Before:** the old home (`app/index.html` + `app/app.js`) loaded a flat list
of three service links (მწუხრი, ცისკარი, ლიტურგია) immediately into the reader.
There was no navigation tier between home and reading — "the app" was
effectively just the reader. Theme toggle and install prompt lived at the
bottom of that same page.

**After:** a structured home screen with four zones:

1. Header — app title, role badge (opens role picker), theme toggle, search field.
2. "გაგრძელება" continue card — last-read text, section name, and a progress
   bar, shown only after the first reading. Links back into the reader at the
   exact block position saved in `mk:last` / `mk:pos:<id>`.
3. მსახურებანი — the three daily services as full-width cards with individual
   progress bars, in liturgical order.
4. ბიბლიოთეკა — 2-per-row category tiles (განგებანი, ლოცვანი) with text
   counts; future categories render as dimmed "მალე" tiles automatically from
   index metadata.

**Why:** the flat list worked for three texts but doesn't scale. The redesign
was specified to accommodate future growth (rites, prayers, feast-day propers,
scores) without changing IA; every new category just becomes another tile.
The continue card restores the one-tap re-entry the single-service old design
gave for free.

---

### Category pages — new screen, why

**Before:** no intermediate page — home linked directly to texts.

**After:** `#/cat/<categoryId>` renders a list of all texts in a category with
their descriptions. The three daily services bypass this (they are pinned on
home), but rites and prayers require it. The page is read from the category
metadata in `data/index.json`, emitted by `build.cjs`.

**Why:** with seven rites and two prayer collections already, and more planned,
a flat home list would become unworkable. Category pages also carry a search
field so the user can filter within a category.

---

### Reader — before / after / why

**Before:** a single scrolling `<div>` rendering all blocks. Rubrics appeared
in muted gray (`#888`). Font scale (`A−/A+`), TOC (☰), rubrics toggle, wake
lock, and speed slider were in a controls row at the top. Swipe-back gesture
navigated to home. Scroll position was saved on `visibilitychange` and
restored on load.

**After:** feature-parity reader plus:

- Vellum design: rubrics in italic rubric-red (`#9e2b25` light / `#d4604f`
  dark), replacing muted gray.
- Drop caps: first letter of the first block after each major section heading
  rendered in rubric red/vermilion via a span with `dropcap` prop.
- All old scroll/position behaviors ported verbatim (inner scroll container,
  restore corrector, momentum-scroll teardown guards — these carry hard-won
  iOS fixes from the old `app.js`).
- TOC sheet and settings sheet are bottom-drawer overlays (not a fixed row).
- Role highlight: blocks whose `role` matches the picker selection get a
  tinted background and left-color bar; the preceding block gets a small cue
  dot.
- "შენ" tag appended to speaker label on highlighted blocks.
- Follow mode entry button in the top bar.
- Next-service auto-chain: at end of a text, a card for the next liturgical
  text appears (vespers → matins → liturgy, defined in `NEXT` map in
  `Reader.svelte`).

**Why:** the rubric and drop-cap changes bring the visual identity in line with
the "Vellum / illuminated manuscript" direction settled in the design spec.
The role and follow-mode additions are the core new capability — see below.

---

### Search — new, how it works

**Before:** no search; the app assumed you know which text contains what you
need.

**After:** a full-text search overlay reachable from the home and category
header search fields. Typing a query runs client-side normalization (Georgian
Unicode diacritics stripped, case-folded) against `data/search-index.json`,
which contains one entry per block: `[blockIndex, sectionName, text]`. Results
show text title, section name, and a snippet with the match highlighted. Tapping
a result navigates to `#/t/<id>?b=<blockIndex>`, opening the reader scrolled
to that block and briefly flashing it.

The search index is emitted by `build.cjs` at build time and precached by the
Workbox SW, so search works offline after first load — no server query.

---

### Role views — new, how it works

**Before:** no role system; all blocks were visually equal regardless of the
`role` field in the JSON (the field existed in the data for years; the old app
did not use it for display).

**After:** a role picker bottom sheet, accessible from the home header role
badge and from the reader settings sheet. Six options: no role (default,
"მლოცველი"), bishop, priest, deacon, reader, choir. Choosing a role causes:

- Every block whose `role` field matches to get a tinted background (role
  color at low alpha) and a 3-pixel colored left border.
- The block immediately before each highlighted block gets a small cue mark
  at its end ("your entrance is next").
- A "შენ" tag on the speaker label of highlighted blocks.

No content is hidden; the spec decision was "highlight, never filter" (see
Non-obvious UX decisions below). The role is stored in `mk:role` in
localStorage.

---

### Follow mode — new, what it does

**Before:** no follow mode. The user had to scroll manually and manage screen
wake separately during a live service.

**After:** a distraction-free reading state entered from the reader top bar.
While active:

- The full header and settings controls collapse to a small ✕ exit chip and
  a wake-lock status dot.
- A bottom stepper bar appears: large ‹ and › buttons (thumb-reachable,
  one-handed) jump between TOC sections; the current section name and
  position within the service (e.g. "ლიტია · 3/9") are displayed centrally.
- Screen wake lock is forced on regardless of the user's saved preference.
- Font is bumped one step above the user's setting for distance readability.
- Role highlighting and auto-scroll remain active.
- Exiting returns the reader to normal chrome at the same scroll position.

---

## Non-obvious UX decisions

### Role = highlight, never filter

The initial brainstorm considered two models: (a) hide other participants'
text so the user only sees their own lines, or (b) highlight the user's lines
while keeping everything visible. The spec chose (b) explicitly.

Reason: liturgical texts are participatory — the bishop needs to see the
deacon's litany to know when to respond; the choir needs to see the prayer
that precedes their antiphon. Hiding other roles would break the flow-reading
use case and disorient anyone using the app as a prompter during a live
service. Highlighting preserves the full service text while adding a
low-attention signal: "your lines are coming."

The cue mark on the preceding block extends this principle — it surfaces a
subtle "prepare" signal without interrupting reading.

### Rubric red + drop caps

**Before:** rubrics were muted gray (`color: #888` in old `style.css`), blending
visually into body text. This was a practical choice: the old app had no
design identity beyond functional legibility.

**After:** rubrics are italic rubric-red (`#9e2b25` / `#d4604f`), and the first
letter of each section's opening block is set as a large drop cap in the same
color.

Reason: the approved design direction ("Vellum / illuminated manuscript") draws
on the historical tradition of liturgical manuscripts where rubrics (from Latin
_rubrica_, red ochre) appear in red to distinguish direction from prayer text.
This is the same convention used in printed Georgian liturgical books. Drop
caps mark section boundaries visually without adding non-textual UI chrome —
they reinforce hierarchy in a way that is native to the content form. The dark
theme switches to vermilion (`#d4604f`), which passes WCAG AA on the dark
background where true rubric red does not.

### Follow mode: visible stepper vs. invisible edge taps

An alternative follow-mode design would use invisible swipe zones or edge taps
to advance sections, keeping the screen completely uncluttered. The spec chose
a visible stepper bar instead.

Reason: follow mode is used in an active liturgical setting where the user's
attention is divided between the screen and the service happening around them.
Invisible interaction targets require memorization and produce errors under
stress (accidental swipes, missed taps). Large, explicitly labeled ‹ › buttons
are error-tolerant and require no instruction. The bottom bar also gives the
current section name and count — information a celebrant or server needs
instantly to know where they are in the service.

### Pinned services vs. pure category hub

A pure hub would show only category tiles on home, requiring two taps to reach
any text. The spec chose a hybrid: the three daily services (the most-used
content by far) are pinned as full-width cards on home, while rites and prayers
are accessible via category tiles.

Reason: the clergy audience opens the app most often at the start of a specific
service. An extra navigation tap before every service is a daily friction cost.
Pinning the three services maintains one-tap reach for the primary use case
while the category layer handles the growing long tail of content.

### Search index built at build time

Client-side search could use a search library that indexes content on first
load. The app builds `search-index.json` at `npm run build` time instead.

Reason: a runtime indexing step adds startup latency on slow mobile hardware
and requires loading all text content before the first search is possible.
Building the index at deploy time means the index is just another precached
JSON — fetched once, available offline, and as fast to query as any other data
file. The index format (one `[blockIndex, sectionName, text]` tuple per block)
is minimal: no markup, no extra metadata, keeping the precache budget small.

---

## Technical migration notes

### Svelte 5 + Vite + Workbox; old SW cutover behavior

The old app (`app/`) used a hand-rolled SW generated by `build.js` from
`sw.template.js`. Cache names were prefixed `kondaki-`. The new app uses
`vite-plugin-pwa` (Workbox `generateSW` mode).

The new SW is emitted to `dist/sw.js` — the same filename and scope root as
the old app's `sw.js`. The old app registered it as:

```js
navigator.serviceWorker.register('sw.js')  // line 597, main:app/app.js
```

(relative to the page, which is at scope root). The new Workbox SW sits at the
same path, so existing installed clients will fetch and activate it without any
registration change.

Workbox config (`vite.config.js`) sets:
- `skipWaiting: true` — the new SW activates immediately without waiting for
  old clients to close.
- `clientsClaim: true` — the new SW takes control of all existing clients
  immediately on activation.
- `cleanupOutdatedCaches: true` — Workbox removes its own outdated precache
  entries automatically.

On first load after the SW activates, `src/main.js` additionally deletes any
cache whose name starts with `kondaki-` — removing the old hand-rolled cache
buckets that Workbox would otherwise leave behind:

```js
if ('caches' in window) {
  caches.keys().then((keys) =>
    keys.filter((k) => k.startsWith('kondaki-')).forEach((k) => caches.delete(k)));
}
```

### localStorage compatibility (positions/settings preserved)

`src/lib/store.js` uses the same `mk:` prefix the old app used for all keys:
`mk:theme`, `mk:font`, `mk:rubrics`, `mk:wake`, `mk:speed`, `mk:pos:<id>`.
Existing users' font preferences, rubric toggle state, theme choice, and all
reading positions survive the upgrade without any migration code.

New keys added: `mk:role` (role picker selection), `mk:last` (last-read text +
timestamp, for the continue card). These are absent for existing users and fall
back to safe defaults (no role, no continue card shown).

### Verification results

#### Offline precache coverage (static analysis of dist/sw.js)

Build: `npm run build` — succeeded, 29 precache entries (2211.84 KiB total).

Data JSONs precached (all 10 text files + index + search index):

```
data/gansatevebelni.json
data/index.json
data/jvari.json
data/kmevebi.json
data/kurtxevani.json
data/litanioba.json
data/liturgy.json
data/matins.json
data/paraklisi.json
data/search-index.json
data/vespers.json
data/ziareba.json
```

Fonts precached: `fonts/nsg-georgian.woff2`, `fonts/nsg-latin-ext.woff2`,
`fonts/nsg-latin.woff2`.

App shell precached: `index.html`, JS bundle, CSS bundle, Workbox runtime,
`manifest.webmanifest`, icon PNGs.

All content needed for offline operation is in the precache manifest. Once the
SW activates on first visit, subsequent loads (and all navigations to texts,
search, and role views) work without network.

Note: true end-to-end offline behavior (SW activation + network cutoff +
reload) requires a browser. The analysis above is static; browser-based
verification (devtools Application → Service Workers → Offline) is recommended
before the first production deploy. This was not run in the current session
because it requires an interactive browser.

#### Upgrade path (static analysis)

- SW path continuity: confirmed. Old app registered `sw.js`; new build emits
  `dist/sw.js` at scope root. Same path, same scope.
- Old cache deletion: confirmed in `src/main.js` (deletes `kondaki-*`).
- Workbox config: confirmed `skipWaiting`, `clientsClaim`,
  `cleanupOutdatedCaches` all set in `vite.config.js`.
- `mk:` key compatibility: confirmed in `src/lib/store.js`.

**Not tested:** real-device iOS standalone upgrade (old SW installed → new SW
activates → app functions correctly in standalone mode). iOS PWA behavior
around `skipWaiting` and `clientsClaim` has historically had edge cases. This
should be verified manually at the first production deploy by:
1. Installing the current `main` branch as a home-screen app on an iOS device.
2. Deploying `feature/redesign` to the production URL.
3. Opening the installed app, waiting for the SW to update (may require two
   opens), and confirming the new home screen loads and saved positions are
   preserved.

#### Unit tests (vitest)

`npx vitest run` — **7 test files, 32 tests, all passed**.

#### End-to-end tests (Playwright)

`npm run e2e` — **6 smoke tests, all passed**:
- home → category → reader
- legacy URL redirect (`#/vespers` → `#/t/vespers`)
- search deep-link to a block
- role highlight after picking choir
- follow mode stepper and section stepping
- theme toggle persistence
