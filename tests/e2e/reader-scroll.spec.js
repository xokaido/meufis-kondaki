import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:4173/';

// Regression: the reader's mount effect must not re-run on scroll state
// changes — that killed auto-scroll and yanked manual scrolls back to the
// saved reading position.

test('manual scroll is not yanked back when a saved position exists', async ({ page }) => {
  await page.goto(BASE + '#/t/vespers');
  await page.waitForSelector('.reader [data-i]');
  await page.evaluate(() => localStorage.setItem('mk:pos:vespers', '120'));
  await page.reload();
  await page.waitForSelector('.reader [data-i]');
  // restore + corrector window is 1200ms — let it fully settle
  await page.waitForTimeout(1500);
  const restored = await page.locator('.scrollwrap').evaluate((el) => el.scrollTop);
  expect(restored).toBeGreaterThan(100); // position restore itself works
  // user scrolls back to the top
  await page.locator('.scrollwrap').evaluate((el) => { el.scrollTop = 0; });
  await page.waitForTimeout(800);
  const top = await page.locator('.scrollwrap').evaluate((el) => el.scrollTop);
  expect(top).toBeLessThan(50); // must NOT snap back to the saved position
});

test('auto-scroll keeps running and advancing', async ({ page }) => {
  await page.goto(BASE + '#/t/vespers');
  await page.waitForSelector('.reader [data-i]');
  await page.getByRole('button', { name: 'ავტო-გადახვევა' }).click();
  await page.waitForTimeout(3000);
  const a = await page.locator('.scrollwrap').evaluate((el) => el.scrollTop);
  await page.waitForTimeout(2000);
  const b = await page.locator('.scrollwrap').evaluate((el) => el.scrollTop);
  expect(a).toBeGreaterThan(20); // moved at all
  expect(b).toBeGreaterThan(a); // still moving
  await expect(page.locator('.speed-pill')).toBeVisible(); // still in auto mode
});
