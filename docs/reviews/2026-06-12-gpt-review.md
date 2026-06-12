# GPT Project Review

Date: 2026-06-12
Repository: `meufis-kondaki`
Branch reviewed: `main`

## Findings

### P1 - Primary Cloudflare Deploy Is Still Build-Only And Can Bypass Tests

The GitHub Pages backup workflow now runs the right gates: `npm run check`,
`npm test`, Playwright install, `npm run e2e`, and then `npm run build`
(`.github/workflows/deploy.yml:35-48`). That fixes the backup path.

The primary production path is different. The README states that Cloudflare's
own git integration publishes `https://gulani.ge` outside this repo's workflow
and runs `npm ci && npm run build` (`README.md:9-12`). `wrangler.jsonc` also
defines only that build command (`wrangler.jsonc:5-7`). A change that passes
build but fails `svelte-check`, Vitest, or Playwright can therefore still reach
the primary site if Cloudflare builds directly from `main`.

Recommendation: make the primary path test-gated too. Either move Cloudflare
publish into GitHub Actions after the existing checks, or change the Cloudflare
build command to include at least `npm run check && npm test && npm run build`.
If Playwright is too heavy in Cloudflare, keep it in GitHub branch protection
and make Cloudflare deploy only after that protected check has passed.

### P2 - Wake Lock UI Is Optimistic Even When Lock Acquisition Fails

`setWake(true)` returns no status and silently does nothing if
`navigator.wakeLock` is unavailable (`src/lib/wake.js:6-11`). It also swallows
request failures. The settings sheet marks the wake button active based on the
saved desired state (`src/components/TocSheet.svelte:11-12`, `:28`), and follow
mode shows a wake dot after calling `setWake(true)` (`src/views/Reader.svelte:157`,
`:290`) regardless of whether a lock was actually acquired.

Impact: users may believe the screen is being kept awake during a service when
the browser denied or does not support the lock.

Recommendation: make wake state observable. Have `setWake` return success or
expose a store like `wakeStatus = unsupported | acquiring | active | failed`,
then render the toggle/dot from actual status. A short unavailable message is
better than a false active indicator.

### P2 - Browser Coverage Is Chromium-Only For WebKit-Sensitive Behavior

The app is explicitly mobile/PWA-oriented and documents iOS installation
(`README.md:66-70`). The reader also carries WebKit-specific comments and
scroll-restore guards (`src/views/Reader.svelte:69-72`, `:191-203`). Current
Playwright config uses an iPhone 13 device profile but forces Chromium
(`playwright.config.js:3-5`), so it does not exercise WebKit's scrolling,
font-loading, service-worker, or standalone-PWA behavior.

Impact: the test suite can pass while Safari/iOS-specific regressions remain
undetected.

Recommendation: add a small WebKit project for core smoke and reader-scroll
tests. Keep the full suite in Chromium if speed matters, but run at least:
home/category/reader, saved-position restore, search deep link, follow mode,
and offline reload in WebKit. Keep a manual real-device iOS standalone upgrade
check in the release checklist.

### P3 - Install Guide Dialog Initially Focuses The Invisible Scrim

The shared dialog action focuses the first focusable descendant by default
(`src/lib/dialog.js:11-13`). The install guide attaches the action to the
wrapper and places the scrim close button before the sheet content
(`src/views/Home.svelte:101-111`). In a browser check, opening the guide left
focus on `button.scrim[aria-label="დახურვა"]`, not the visible "გასაგებია"
button or a heading.

Impact: keyboard and screen-reader users land on an invisible close target when
the install instructions open.

Recommendation: either attach the dialog action to `.gsheet` instead of the
outer `.guide`, move the scrim after the sheet in DOM order, or pass an explicit
initial focus target for the visible confirmation button.

### P3 - Playwright May Reuse A Stale Local Preview Server

`playwright.config.js:6-10` uses `reuseExistingServer: true`. If port `4173`
already has an old preview server running, local E2E can attach to stale build
output instead of the current workspace. CI is likely clean, but local review
and debugging can get false positives.

Recommendation: use `reuseExistingServer: !process.env.CI`, or set it to
`false` when running release verification. If local reuse is kept for speed,
document that reviewers should stop old preview servers before trusting E2E
results.

### P3 - Frontmatter Allows Silent Typos In Optional Fields

`parseFrontmatter()` validates required fields and landmark formatting
(`build.cjs:36-62`), and `main()` validates categories and duplicate ids
(`build.cjs:251-260`). Optional fields such as `mode` and unknown keys are not
validated. A typo like `mode: hybird` silently falls through to default service
parsing, which can misclassify text without an explicit build error.

Recommendation: validate allowed keys and allowed modes (`hybrid`, `text`, or
empty). Also consider validating id format against the filename suffix so URL
ids stay stable and predictable.

## Verification Performed

- `npm run check`: passed, 0 Svelte errors/warnings.
- `npm test`: passed, 8 test files and 89 tests.
- `npm run build`: passed. Built 10 text JSON files plus index/search data.
- `npm run e2e`: passed, 12 Playwright tests.
- `npm audit --audit-level=low`: 0 vulnerabilities.
- Generated data consistency script: 10 texts, 5 categories, no duplicate ids,
  no missing text JSON, no bad TOC anchors, no unknown block types or roles.
- PWA precache inspection: 25 entries, no duplicate URLs, all data/search JSON
  files present.
- Browser offline smoke test: passed. After SW activation, offline reload,
  opening an unvisited text, and offline search with highlighted result worked.
- Browser install-guide focus check: focus initially landed on the scrim button.

## Resolved Since The Prior Review

The previous review at `docs/reviews/2026-06-12-review.md` now includes a
disposition table. The major prior findings are addressed in the current tree:

- Deployment story is documented as Cloudflare-primary plus GitHub Pages backup.
- Backup deploy workflow now runs static checks, unit tests, and E2E before
  publishing.
- Node version is pinned with `engines` and `.nvmrc`.
- `svelte-check` exists and passes.
- Search result highlighting is implemented with safe Svelte text rendering.
- Follow mode now scales `--fs`, and an E2E regression test covers it.
- Dialog Escape/focus behavior exists for the main overlays and is covered by
  E2E tests.
- `.vite/` and `.wrangler/` are ignored.
- Historical docs are archived with banners.
- Generated-data golden coverage exists over real source texts.

## Positive Findings

- The frontmatter-based `texts/` pipeline is a clear improvement over hardcoded
  source lists; adding ordinary texts no longer requires editing `build.cjs`.
- Runtime architecture remains simple: static JSON, hash routing, no backend,
  and no runtime dependencies.
- HTML injection risk remains low: `fmt()` escapes text before applying limited
  emphasis, and search highlighting uses Svelte text nodes rather than raw HTML.
- The PWA build is healthy: no font warning, no duplicate precache URLs, all
  data/search files precached, and offline smoke passed.
- Tests now cover parser behavior, real generated data, routing, search
  normalization/snippets, roles, storage, dialog behavior, reader scrolling,
  follow-mode scaling, and auto-scroll.

## Recommended Priority Order

1. Gate the primary Cloudflare production deploy on the same checks as the
   backup path.
2. Make Wake Lock UI reflect actual acquisition/support state.
3. Add minimal WebKit coverage plus a manual iOS standalone release checklist.
4. Fix install-guide initial focus.
5. Tighten Playwright server reuse and frontmatter validation.

## Commands Run

```sh
npm run check
npm test
npm run build
npm run e2e
npm audit --audit-level=low
node <generated-data-consistency-check>
node <precache-duplicate-and-coverage-check>
node/playwright <offline-service-worker-smoke-check>
node/playwright <install-guide-focus-check>
```

---

## Disposition (2026-06-12, branch `fix/gpt-review`)

| Finding | Status |
|---|---|
| P1 Cloudflare deploy bypasses tests | Fixed — wrangler build command runs `check + test` before bundling; e2e gates gh-pages in Actions (no browsers in CF build image) |
| P2 wake lock UI optimistic | Fixed — `wakeStatus` store (`off/active/failed/unsupported`); TocSheet button lights only on an actual lock and names the failure; follow-mode dot reflects real state; unit-tested |
| P2 Chromium-only coverage | Fixed — WebKit Playwright project (offline excluded; SW is Chromium-only in Playwright). Immediately caught Safari's button-skipping Tab escaping dialogs — focus trap now cycles manually |
| P3 install-guide focuses scrim | Already fixed by the OPUS M4 work (scrim tabindex=-1 + trap filter); regression e2e added proving focus lands on "გასაგებია" |
| P3 stale preview server reuse | Fixed — `reuseExistingServer: !process.env.CI` |
| P3 silent frontmatter typos | Fixed — unknown keys and invalid modes throw; filename id must equal frontmatter id |
