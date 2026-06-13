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

test('follow mode actually enlarges the reader text', async ({ page }) => {
  await page.goto(BASE + '#/t/vespers');
  await page.waitForSelector('.reader [data-i]');
  const sizeOf = () =>
    page.locator('.reader .blk').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  const before = await sizeOf();
  await page.getByRole('button', { name: 'სარჩევი' }).click();
  await page.getByRole('button', { name: /თვალყურის დევნება/ }).click();
  const during = await sizeOf();
  expect(during).toBeGreaterThan(before * 1.05);
  await page.getByRole('button', { name: /დასრულება/ }).click();
  const after = await sizeOf();
  expect(after).toBeCloseTo(before, 1);
});

test('swipe right navigates back home', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Touch() constructor is unavailable in Playwright WebKit');
  await page.goto(BASE + '#/t/vespers');
  await page.waitForSelector('.reader [data-i]');
  await page.locator('.scrollwrap').evaluate((el) => {
    const touch = (x, y) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
    const fire = (type, x, y) => el.dispatchEvent(new TouchEvent(type, {
      touches: type === 'touchend' ? [] : [touch(x, y)],
      changedTouches: [touch(x, y)],
      bubbles: true,
    }));
    fire('touchstart', 40, 300);
    fire('touchmove', 160, 305);   // locks horizontal (dx ≫ dy)
    fire('touchmove', 260, 305);
    fire('touchend', 330, 305);    // past a third of the 390px viewport
  });
  await expect(page).toHaveURL(/\/$|#\/?$/);
  await expect(page.getByRole('heading', { name: 'მეუფის კონდაკი' })).toBeVisible();
});

test('book mode paginates and flips on left/right taps', async ({ page }) => {
  await page.goto(BASE + '#/t/vespers');
  await page.waitForSelector('.reader [data-i]');
  await page.evaluate(() => localStorage.removeItem('mk:book'));
  await page.reload();
  await page.waitForSelector('.reader [data-i]');

  // enter book mode from the top bar
  await page.getByRole('button', { name: 'წიგნის რეჟიმი' }).click();
  await expect(page.locator('.view.book')).toBeVisible();
  await expect(page.locator('.scrollwrap')).toHaveCSS('overflow', 'hidden');
  const pageNum = page.locator('.page-num');
  await expect(pageNum).toHaveText(/^1 \/ \d+$/);

  const box = await page.locator('.scrollwrap').boundingBox();
  const tap = (frac) => page.mouse.click(box.x + box.width * frac, box.y + box.height * 0.5);

  // a tap on the right advances; once the page-turn settles, scrollLeft has
  // moved by exactly one viewport
  await tap(0.8);
  await expect(pageNum).toHaveText(/^2 \//);
  await expect
    .poll(() => page.locator('.scrollwrap').evaluate((el) => Math.round(el.scrollLeft)))
    .toBe(Math.round(box.width));

  // a tap on the left goes back
  await tap(0.15);
  await expect(pageNum).toHaveText(/^1 \//);

  // leaving book mode returns to continuous scroll
  await page.getByRole('button', { name: 'გრაგნილის რეჟიმი' }).click();
  await expect(page.locator('.view.book')).toHaveCount(0);
  await expect(page.locator('.scrollwrap')).toHaveCSS('overflow-y', 'auto');
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
