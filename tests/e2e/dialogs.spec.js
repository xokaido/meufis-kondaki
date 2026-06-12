import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:4173/';

test('Escape closes the search overlay and restores trigger focus', async ({ page }) => {
  await page.goto(BASE);
  await page.getByText('ძიება ყველა ტექსტში').click();
  await expect(page.getByPlaceholder('ძიება ყველა ტექსტში…')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByPlaceholder('ძიება ყველა ტექსტში…')).toHaveCount(0);
  await expect(page.locator('.srch')).toBeFocused();
});

test('Escape closes the role sheet; Tab stays inside it while open', async ({ page }) => {
  await page.goto(BASE);
  await page.getByRole('button', { name: 'როლის არჩევა' }).click();
  const sheet = page.locator('.sheet[aria-label="როლის არჩევა"]');
  await expect(sheet).toHaveAttribute('aria-modal', 'true');
  // tab through more stops than the sheet has — focus must remain inside
  for (let i = 0; i < 10; i++) await page.keyboard.press('Tab');
  const inside = await page.evaluate(() =>
    !!document.activeElement.closest('.sheet'));
  expect(inside).toBe(true);
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
});

test('document title follows navigation and never goes stale', async ({ page }) => {
  await page.goto(BASE + '#/t/vespers');
  await expect(page).toHaveTitle(/მწუხრი/);
  await page.getByRole('button', { name: 'უკან' }).click();
  await expect(page).toHaveTitle('მეუფის კონდაკი');
  await page.goto(BASE + '#/cat/rites');
  await expect(page).toHaveTitle(/განგებანი/);
});

test('Escape closes the reader TOC sheet', async ({ page }) => {
  await page.goto(BASE + '#/t/vespers');
  await page.getByRole('button', { name: 'სარჩევი' }).click();
  const sheet = page.locator('.sheet[aria-label="სარჩევი და პარამეტრები"]');
  await expect(sheet).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
});
