import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const FIXTURE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

async function mockGalleryApi(page: import('@playwright/test').Page) {
  const mockIds = Array.from({ length: 12 }, (_, i) => `mock-gallery-img-${i}`);

  await page.route('**/image/list/browser_upload.json', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        resources: mockIds.map((id) => ({ public_id: id })),
      }),
    }),
  );

  await page.route('**/image/upload/mock-gallery-img-*.png', (route) => {
    const url = route.request().url();
    const match = url.match(/mock-gallery-img-(\d+)\.png/);
    const idx = match ? Number(match[1]) % 3 : 0;
    const file = path.join(FIXTURE_DIR, `gallery-placeholder-${idx}.png`);
    route.fulfill({
      contentType: 'image/png',
      body: fs.readFileSync(file),
    });
  });
}

test.describe('Gallery Page', () => {
  test('loads gallery page with pagination buttons', async ({ page }) => {
    await mockGalleryApi(page);
    await page.goto('/gallery');
    await expect(page.getByRole('heading', { name: 'LastWave' })).toBeVisible();
    await expect(page.getByRole('button', { name: '← Previous' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Next →' })).toBeVisible();
  });

  test('paginates between pages', async ({ page }) => {
    await mockGalleryApi(page);
    await page.goto('/gallery');
    await expect(page.getByText('Page 1 / 2')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Next →' }).click();
    await expect(page.getByText('Page 2 / 2')).toBeVisible();
  });
});
