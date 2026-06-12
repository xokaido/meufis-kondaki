> **ისტორიული დოკუმენტი / Historical document.** Snapshot of its date; paths and architecture may no longer match the current repo. See README.md for the current layout.

# მეუფის კონდაკი — Mobile-First Redesign

**Date:** 2026-06-12
**Status:** Approved by user (brainstorming session)
**Branch:** `feature/redesign` (no merge to main; user reviews and merges manually)

## Goal

Redesign the existing PWA (gulani.ge) into a role-aware, scalable liturgical
library with a live-service follow mode, in a refined "vellum / illuminated
manuscript" visual language. Rebuild on Svelte 5 + Vite (user's choice over
keeping vanilla JS).

## Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Role model | Highlight my lines — never hide other participants' text; cue mark on the block before mine |
| Content growth | More services/rites, feast-day propers, prayer collections, music scores — IA must accommodate all |
| Follow mode | Local single-device (no backend); layout A: section stepper bar |
| Scope now | Full category navigation AND client-side full-text search now; calendar/propers surfacing deferred |
| Audience | Clergy & servers first; lay "following along" is the no-role default |
| Visual direction | B "Vellum / illuminated", light primary + candlelit-vellum dark twin, user-switchable, system default |
| Home structure | B: pinned daily services + category tiles opening category pages |
| Architecture | Framework rewrite: Svelte 5 + Vite (user chose over vanilla ES modules) |

## 1. Information Architecture

**Content categories** (metadata in `app/data/index.json`, emitted by `build.js`):

- `services` — მწუხრი, ცისკარი, ლიტურგია (pinned on home, in liturgical order)
- `rites` (განგებანი) — კმევები, მცირე პარაკლისი, ლიტანიობა, ჯვართამაღლების ცისკარზე, მცირე კურთხევანი
- `prayers` (ლოცვანი) — ლოცვები ზიარების წინ, განსატევებელნი
- Future: `propers` (დღესასწაულნი), `scores` (საგალობლები) — tiles render automatically
  from index metadata; "მალე" (coming soon) state until populated

**Routes** (hash-based, hand-rolled router, no dependency):

- `#/` — home
- `#/cat/<categoryId>` — category page (list, sub-groupable, scales to dozens of texts)
- `#/t/<textId>` — reader
- `#/t/<textId>?b=<blockIndex>` — reader deep link to a block (used by search)
- Search is an overlay reachable from home and category pages, not a route
- **Legacy redirects:** old `#/vespers` style URLs map to `#/t/vespers` (keep
  installed-app bookmarks working)

**Home screen** (validated mockup: "home-layout B"):

1. Header: cross mark · app title · role badge (tap → role picker)
2. Search field (opens search overlay)
3. "გაგრძელება" continue card — last-read text + section + progress bar (only when a position exists)
4. მსახურებანი — the three services as full-width cards with progress
5. ბიბლიოთეკა — category tiles (2-per-row) with text counts; future categories appear dimmed with "მალე"
6. Install button + theme toggle preserved from current app

**Findability model:** browse path = home → category → text → TOC;
search path = any screen → search overlay → result → deep link into reader.
Both stay ≤3 taps at hundreds of texts.

## 2. Search

- `build.js` emits `app/data/search-index.json`: per text, per block — plain
  text (markup stripped), block index, owning TOC section title.
- Client-side matching with Georgian-aware normalization (lowercase, strip
  punctuation; no stemming — exact substring/token match is appropriate for
  liturgical Georgian).
- Index lazy-loads on first search open (it is precached by the service
  worker, so offline search works).
- Results grouped by text, showing section context and highlighted match;
  tap → `#/t/<id>?b=<i>`, reader scrolls to and briefly flashes the block.

## 3. Role System

- Roles: მღვდელმთავარი (bishop), მღვდელი (priest), დიაკონი (deacon),
  მკითხველი (reader), გუნდი (choir), and the default **no role** ("მლოცველი" /
  following along).
- Picker: role badge on home header + entry in reader settings sheet. A
  bottom sheet with the six options, role icons, and role colors. No
  first-launch prompt — default experience must work instantly.
- Effect of choosing a role (the *only* effect — nothing is hidden):
  - Blocks whose `role` matches get highlight treatment: tinted background
    (role color at low alpha), 3px colored left bar, "შენ" tag appended to
    the speaker label.
  - The block immediately preceding a highlighted block gets a small cue
    mark (subtle icon at its end) — "your entrance is next."
- Existing block `role` data (from `ROLE_RULES` in build.js) is the source;
  no content duplication. `reader` role blocks already exist in data.
- Rubrics remain an independent toggle (default on, per clergy-first audience).
- Stored in localStorage (`mk:role`).

## 4. Design System

**Identity:** "Vellum / illuminated manuscript." Two themes sharing one
component layer via CSS custom properties; toggle in top bars, default =
system preference (current behavior preserved).

**Light (primary):** parchment ground `#f6efdd`, warm ink `#33291b`,
true rubric red `#9e2b25` for rubrics, drop caps, accents, progress.
**Dark (candlelit vellum):** warm near-black `#191310`, ink `#e8dcc2`,
vermilion `#d4604f` replacing rubric red (validated for dark-bg readability).

- Role colors carried over from the current app, per theme (bishop purple,
  priest terracotta, deacon gold, choir green/teal, verse blue).
- Typography: Noto Serif Georgian (existing self-hosted woff2 subsets);
  font-size scale via `--fs` custom property (existing mechanism, 0.8–1.7).
- Illuminated drop caps: first letter of the first block after each major
  section heading, rendered in rubric red/vermilion. CSS `::first-letter`
  or a span — implementation detail, but must not break text selection or
  screen readers.
- Rubrics set in italic rubric-red (historical manuscript convention),
  replacing the current muted-gray treatment.
- All tokens defined once in `src/styles/tokens.css`; exact values for the
  full palette to be finalized in Phase 1 against WCAG AA contrast.

## 5. Reader

Feature parity with the current reader, restyled, componentized:

- Block types unchanged: `say` (speaker + role), `rubric`, `text`, `prayer`,
  `head`, `sep`; collapsible prayer groups (heading + consecutive prayers).
- Top bar: back, title + current section, auto-scroll toggle, theme toggle, menu.
- Bottom sheet: font A−/A+, rubrics toggle, wake lock toggle, TOC with
  current-section marker.
- Preserved behaviors: scroll-position save/restore per text (existing
  `mk:pos:` keys honored), progress bar, jump-to-top/bottom FAB,
  auto-scroll with speed control, swipe-right-to-go-back gesture,
  next-service chaining (vespers → matins → liturgy).
- New: "follow mode" entry button (prominent, near auto-scroll).

## 6. Follow Mode (validated mockup: "follow-mode A")

Local, single-device, distraction-free reading state for live services:

- Enter from reader top bar; exit via ✕ chip — returns to normal reader at
  the same position.
- Chrome collapses to: top — exit chip + wake indicator; bottom — slim
  stepper bar with large ‹ › section buttons (one-handed, thumb-reachable),
  current section name, and position within service (e.g. "ლიტია · 3/9").
- Behavior: screen wake lock forced on; font bumped one step above the
  user's setting; free scrolling within a section; ‹ › jump section
  boundaries; role highlight active; auto-scroll still available.
- No backend, no sync; position anchors are block indices (the existing
  mechanism), which would be the anchor unit if sync is ever added later.

## 7. Technical Architecture

- **Stack:** Svelte 5 (runes), Vite, `vite-plugin-pwa` (Workbox precache of
  app shell + all data JSONs — preserves the offline-everything guarantee).
  Replaces hand-rolled `sw.template.js`/`app/sw.js`.
- **Structure:**
  - `src/main.js`, `src/App.svelte` — boot + route switch
  - `src/lib/router.js` — hash router + legacy redirect map
  - `src/lib/stores.js` — persisted stores (theme, font, rubrics, wake,
    role, speed, positions) on existing `mk:` localStorage keys (no data
    loss on upgrade)
  - `src/lib/search.js` — normalization + matching
  - `src/views/` — Home, Category, Reader, FollowMode
  - `src/components/` — Block, RoleSheet, TocSheet, SearchOverlay,
    ContinueCard, InstallPrompt, …
  - `src/styles/tokens.css`, global styles
- **Data pipeline:** `build.js` stays (markdown → `data/*.json`), extended to
  emit category metadata in `index.json` and `search-index.json`. Runs
  before `vite build` (`npm run build` = `node build.js && vite build`).
  Data JSONs served from `public/data/` (copied verbatim by Vite).
- **Deployment:** `wrangler.jsonc` and `.github/workflows/deploy.yml` switch
  to the Vite output directory (`dist/`). Fonts/icons move under `public/`.
- **Testing:** vitest — build.js parser, search normalization/matching, role
  cue computation, router/redirects. Playwright smoke — home → category →
  reader, search deep link, role highlight, follow mode, theme toggle,
  offline reload.

## 8. Phases (each = scoped commits on `feature/redesign` + summary for review)

1. **Scaffold + tokens:** Vite/Svelte/PWA setup, tokens.css (both themes,
   AA-checked), fonts, build pipeline, deploy config; app boots to a
   minimal parity home. *(Old `app/` stays untouched until cutover at the end of this phase.)*
2. **Navigation/IA:** home layout B, category pages, router + legacy
   redirects, continue card, install prompt, theme toggle.
3. **Reader:** all block types, prayer groups, TOC/settings sheets,
   position restore, auto-scroll, swipe-back, next-service chain.
4. **Search:** index generation, overlay, deep links, block flash.
5. **Roles:** picker sheet, highlight + "შენ" tag, cue marks, role badge.
6. **Follow mode + polish:** stepper layout, wake/font behavior, offline
   verification, final summary doc with before/after UX notes.

## Out of Scope

- Synced multi-device following (would need a backend; block-index anchors
  keep the door open)
- Calendar-aware propers surfacing, score rendering (IA accommodates them;
  content doesn't exist yet)
- Any content/text changes; `*.md` sources are untouched
- Localization beyond Georgian

## Risks

- **PWA cutover:** installed clients run the old hand-rolled SW; the
  Workbox SW must take over cleanly (same scope, `skipWaiting` +
  `clients.claim`, old cache names purged). Verify on iOS standalone
  specifically.
- **iOS scroll quirks:** the current code carries hard-won fixes (inner
  scroll container, restore corrector, momentum-scroll teardown guards).
  Port these deliberately, not incidentally.
- **Bundle size:** Svelte's compiled output is small, but precache size now
  includes the search index; keep it compact (strip markup, no positions
  beyond block index).
