import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const FIXTURE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

async function mockGalleryApi(page: import('@playwright/test').Page) {
  const mockIds = Array.from({ length: 20 }, (_, i) => `mock-gallery-img-${i}`);

  await page.route('**/image/list/browser_upload.json', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        resources: mockIds.map((id, i) => ({
          public_id: id,
          width: i % 4 === 0 ? 9000 : i % 3 === 0 ? 5000 : i % 2 === 0 ? 2400 : 800,
          height: 600,
        })),
      }),
    }),
  );

  await page.route('**/image/upload/**mock-gallery-img-*.png', (route) => {
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
  test('loads gallery page with image grid', async ({ page }) => {
    await mockGalleryApi(page);
    await page.goto('/gallery');
    await expect(page.getByRole('heading', { name: 'LastWave' })).toBeVisible();
    await expect(page.locator('img[loading="lazy"]').first()).toBeVisible({ timeout: 15000 });
  });

  test('shows Load More button and loads more images', async ({ page }) => {
    await mockGalleryApi(page);
    await page.goto('/gallery');
    const loadMore = page.getByTestId('load-more');
    await expect(loadMore).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Showing 12 of 20')).toBeVisible();
    await loadMore.click();
    await expect(page.getByText('20 visualizations')).toBeVisible();
    await expect(loadMore).not.toBeVisible();
  });
});
