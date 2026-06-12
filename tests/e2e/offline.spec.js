import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:4173/';

// The architecture exists for this: after the service worker activates, the
// whole library — including texts never opened and search — works offline.
test('app works fully offline after first visit', async ({ page, context }) => {
  await page.goto(BASE);
  // wait until the SW controls the page and precaching is complete
  await page.waitForFunction(
    () => navigator.serviceWorker.controller !== null, null, { timeout: 30000 });
  await page.evaluate(() => navigator.serviceWorker.ready);

  await context.setOffline(true);

  // reload entirely from the SW
  await page.reload();
  await expect(page.getByRole('heading', { name: 'მეუფის კონდაკი' })).toBeVisible();

  // open a text that was never visited in this session (precached JSON)
  await page.goto(BASE + '#/cat/rites');
  await page.getByText('მცირე კურთხევანი').click();
  await expect(page.locator('.reader .blk').first()).toBeVisible();

  // search works offline too (search-index.json is precached)
  await page.goto(BASE);
  await page.getByText('ძიება ყველა ტექსტში').click();
  await page.getByPlaceholder('ძიება ყველა ტექსტში…').fill('უფალო შეგვიწყალენ');
  await expect(page.locator('.hit').first()).toBeVisible();

  await context.setOffline(false);
});
