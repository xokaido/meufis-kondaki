> **ისტორიული დოკუმენტი / Historical document.** Snapshot of its date; paths and architecture may no longer match the current repo. See README.md for the current layout.

# მეუფის კონდაკი — Mobile App Plan

A plan for turning the existing web app (`app/` — vanilla HTML/CSS/JS, no build
step, no server dependency) into a mobile app. Written 2026-06-10 against the
v=8 state of the code.

## Current state (what we build on)

- Fully static single-page app: `index.html`, `style.css`, `app.js`, `data.js`
  (~700 KB total, dominated by `data.js` text).
- Already mobile-first: safe-area insets, inner scroll container, wake lock,
  dark/light themes, position persistence in `localStorage`, hash routing.
- Only network dependency: Google Fonts (Noto Serif Georgian) — has a system
  fallback, but offline font loading must be solved for a real app.
- Content pipeline: `node build.js` regenerates `data.js` from the markdown
  sources. Any mobile packaging must keep this one-command flow.

## Options considered

| Option | Effort | Result | Verdict |
|---|---|---|---|
| 1. PWA (manifest + service worker) | ~half a day | Installable from browser, offline, full-screen; no App Store presence | **Do first — required groundwork for everything else** |
| 2. Capacitor wrapper around the same files | ~2–4 days incl. store setup | Real iOS/Android apps in the stores, native splash/icons, native keep-awake | **Recommended end state** |
| 3. React Native / Flutter rewrite | weeks | Native UI, but throws away working code | Rejected — no benefit for a text-reading app |

Capacitor (option 2) is the right wrapper because the app is already plain
static files: Capacitor literally serves the `app/` directory inside a native
WebView. No framework migration, the web version keeps working unchanged.

---

## Phase 1 — PWA (prerequisite + immediate win)

Goal: the app installs to the home screen from Safari/Chrome, opens
full-screen, and works fully offline (church basements have no signal).

1. **Web app manifest** — `app/manifest.webmanifest`:
   - `name`: "მეუფის კონდაკი", `short_name`: "კონდაკი"
   - `display: standalone`, `orientation: portrait`
   - `background_color`/`theme_color`: `#161210`
   - `start_url: ./index.html`
   - Icons: 192/512 px PNG + maskable variant (generate from the gold ☩ on
     dark ground; see icon task below).
2. **Self-host the font** — download Noto Serif Georgian woff2 (weights
   400/500/600/700) into `app/fonts/`, replace the Google Fonts `<link>` with
   local `@font-face` + `font-display: swap`. This removes the only network
   dependency and makes font-shift restore logic less relevant.
3. **Service worker** — `app/sw.js`, precache-everything strategy (the whole
   app is ~10 files):
   - Cache name keyed by a version string; bump it in `build.js` output so
     each `node build.js` produces a new cache version automatically (replaces
     today's manual `?v=N` bumps — fold those into the generated version).
   - `install`: precache index, css, js, data.js, fonts, manifest.
   - `fetch`: cache-first.
   - `activate`: delete old caches.
4. **iOS specifics** — `apple-touch-icon` link, `apple-mobile-web-app-capable`
   meta. Note: iOS standalone PWAs persist `localStorage` but Safari can evict
   it after weeks of disuse; acceptable now, fixed properly in Phase 2.
5. **Verify** — Lighthouse PWA audit ≥ 90; airplane-mode test: open installed
   app, all ten services readable, theme/font/position settings survive.

Deliverables: `manifest.webmanifest`, `sw.js`, `fonts/`, icon PNGs,
registration snippet in `app.js`, version automation in `build.js`.

## Phase 2 — Native apps with Capacitor

Goal: installable from App Store / Google Play, native polish, no PWA storage
eviction risk.

1. **Project setup** (one time):
   ```sh
   npm init -y
   npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
   npx cap init "მეუფის კონდაკი" ge.ostati.kondaki --web-dir app
   npx cap add ios && npx cap add android
   ```
   Keep the repo layout: markdown sources and `build.js` at root, `app/` is
   the web dir Capacitor copies. Sync flow becomes:
   `node build.js && npx cap sync`.
2. **Plugins** (each replaces a web API that is unreliable in WebViews):
   - `@capacitor-community/keep-awake` — replaces the Wake Lock API toggle
     (`navigator.wakeLock` is flaky inside iOS WKWebView). In `app.js`, branch:
     use the plugin when `window.Capacitor` exists, else the web API.
   - `@capacitor/preferences` — mirror the `store` helper writes so reading
     positions survive WebView storage clears. Keep `localStorage` as the
     synchronous read path; write-through to Preferences and hydrate from it
     on cold start.
   - `@capacitor/status-bar` — match status bar style to the active theme
     (call from `applySettings()`).
   - `@capacitor/splash-screen` — dark splash with the gold cross.
3. **App icons & splash** — generate once with `@capacitor/assets` from a
   single 1024px source image (gold ☩ on `#161210`). The same source feeds the
   PWA icons from Phase 1.
4. **Code adjustments** (small, all in `app.js`/`index.html`):
   - Feature-detect Capacitor for the plugin branches above (~30 lines).
   - Hash routing, inner scroll container, themes: work as-is in WebViews.
   - Android back button: `@capacitor/app` `backButton` listener → if in a
     reader view go home (`location.hash = ''`), else let the app minimize.
5. **Platform housekeeping**:
   - iOS: set `UIViewControllerBasedStatusBarAppearance`, portrait-only,
     minimum iOS 14; test on a physical device — scrolling, wake lock, font
     rendering of ჱ/ჳ/ჴ/ჵ glyphs.
   - Android: `windowSoftInputMode` irrelevant (no inputs); target latest SDK;
     test back gesture and dark system bars.

## Phase 3 — Store submission

1. Apple Developer account ($99/yr) and Google Play account ($25 once).
2. Bundle ID `ge.ostati.kondaki` (or preferred reverse-domain), version 1.0.0.
3. Privacy: the app collects nothing, stores everything on-device — write a
   one-page privacy policy stating that (both stores require a URL).
4. Store listings: Georgian + English descriptions, 6.5" and 5.5" iPhone
   screenshots, Play feature graphic. Screenshots: home (dark), reader with
   speaker colors, TOC sheet, light theme.
5. App Review notes: explain it is a liturgical text reader (Apple sometimes
   flags "book-like" apps — emphasize the service-following features: TOC,
   roles, wake lock, progress).

## Risks / decisions to make later

- **data.js size in memory** (~650 KB JSON parsed at startup): fine today;
  if more service books are added, switch to per-service JSON files loaded on
  demand (one-line change in the SW precache list).
- **Content updates after store release**: text fixes require a store update
  unless we add a remote-update check. Recommendation: don't — keep the app
  fully offline; ship text corrections as normal app updates.
- **PWA vs stores**: if store accounts are a blocker, Phase 1 alone is a
  complete, shareable product (send a URL, "Add to Home Screen").

## Effort summary

| Phase | Effort | Outcome |
|---|---|---|
| 1 — PWA | ~half a day | Offline, installable, shareable by URL |
| 2 — Capacitor | ~2 days dev + device testing | Native iOS/Android builds |
| 3 — Stores | ~1 day + review wait (days) | Public App Store / Play listings |
