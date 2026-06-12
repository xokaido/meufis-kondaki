import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    // CI must never attach to a stale server; locally reuse is a speed win —
    // stop old preview servers before trusting local e2e results.
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    // Safari-engine pass for WebKit-sensitive reader behavior (inner-scroll
    // restore, fonts, gestures). Playwright supports service workers only in
    // Chromium, so the offline suite stays out of this project.
    {
      name: 'webkit',
      use: { ...devices['iPhone 13'] },
      testIgnore: '**/offline.spec.js',
    },
  ],
});
