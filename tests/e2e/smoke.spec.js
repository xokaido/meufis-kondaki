import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:4173/';

test('home → category → reader', async ({ page }) => {
  await page.goto(BASE);
  await expect(page.getByRole('heading', { name: 'მეუფის კონდაკი' })).toBeVisible();
  await page.getByText('განგებანი').click();
  await page.getByText('მცირე პარაკლისი', { exact: true }).click();
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

test('role switches in one tap from the reader top bar', async ({ page }) => {
  await page.goto(BASE + '#/t/vespers');
  await page.waitForSelector('.reader [data-i]');
  await expect(page.locator('.blk.mine')).toHaveCount(0);
  await page.getByRole('button', { name: 'როლის არჩევა' }).click();
  await page.getByRole('button', { name: 'გუნდი', exact: true }).click();
  // highlight applies immediately, no navigation needed
  await expect(page.locator('.blk.mine').first()).toBeVisible();
  // the top-bar icon now reflects the active role
  await expect(page.getByRole('button', { name: /როლის არჩევა — გუნდი/ })).toBeVisible();
});

test('script switcher toggles khucuri and persists', async ({ page }) => {
  await page.goto(BASE + '#/t/vespers');
  await page.waitForSelector('.reader [data-i]');
  const family = () =>
    page.locator('.scrollwrap').evaluate((el) => getComputedStyle(el).fontFamily);
  expect(await family()).not.toContain('Khutsuri');
  // sentence initials follow the normal font in mkhedruli mode…
  const si = page.locator('.reader .blk .si').first();
  const siFamily = () => si.evaluate((el) => getComputedStyle(el).fontFamily);
  expect(await siFamily()).not.toContain('Khutsuri');
  await page.getByRole('button', { name: 'ხუცურზე გადართვა' }).click();
  expect(await family()).toContain('Khutsuri Nuskhuri');
  // …and become Asomtavruli capitals in khucuri mode
  expect(await siFamily()).toContain('Khutsuri Asomtavruli');
  // headings take Asomtavruli over the Nuskhuri body (vespers' headings are
  // all prayer-group summaries, i.e. .ghead)
  const headFamily = await page.locator('.reader .ghead').first()
    .evaluate((el) => getComputedStyle(el).fontFamily);
  expect(headFamily).toContain('Khutsuri Asomtavruli');
  // persists across reload
  await page.reload();
  await page.waitForSelector('.reader [data-i]');
  expect(await family()).toContain('Khutsuri Nuskhuri');
  await page.getByRole('button', { name: 'მხედრულზე გადართვა' }).click();
  expect(await family()).not.toContain('Khutsuri');
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
  await page.getByRole('button', { name: 'თემა' }).first().click();
  await page.reload();
  const after = await page.evaluate(() => document.documentElement.dataset.theme);
  expect(after).not.toBe(before);
});
