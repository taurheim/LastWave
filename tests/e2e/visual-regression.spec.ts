import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const FIXTURE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

/** Mock Cloudinary gallery API and images so snapshots are deterministic. */
async function mockGalleryApi(page: import('@playwright/test').Page) {
  const mockIds = ['mock-gallery-img-0', 'mock-gallery-img-1', 'mock-gallery-img-2',
                   'mock-gallery-img-3', 'mock-gallery-img-4', 'mock-gallery-img-5',
                   'mock-gallery-img-6', 'mock-gallery-img-7', 'mock-gallery-img-8'];

  // Intercept the Cloudinary JSON listing
  await page.route('**/image/list/browser_upload.json', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        resources: mockIds.map((id) => ({ public_id: id })),
      }),
    }),
  );

  // Intercept image requests and serve local placeholder PNGs
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

test.describe('Visual Regression', () => {
  test('about page matches baseline', async ({ page }, testInfo) => {
    await page.goto('/about');
    const vp = testInfo.project.name.replace('visual-', '');
    await expect(page).toHaveScreenshot(`about-${vp}.png`, {
      maxDiffPixelRatio: 0.01,
    });
  });

  test('gallery page matches baseline', async ({ page }, testInfo) => {
    await mockGalleryApi(page);
    await page.goto('/gallery');
    await page.getByRole('button', { name: 'Next →' }).waitFor({ timeout: 15000 });
    await page.waitForLoadState('networkidle');
    const vp = testInfo.project.name.replace('visual-', '');
    await expect(page).toHaveScreenshot(`gallery-${vp}.png`, {
      maxDiffPixelRatio: 0.01,
    });
  });

  test('home page options form matches baseline', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Generate' }).waitFor({ timeout: 15000 });
    await page.waitForTimeout(500);
    const vp = testInfo.project.name.replace('visual-', '');
    await expect(page).toHaveScreenshot(`home-options-${vp}.png`, {
      maxDiffPixelRatio: 0.01,
    });
  });
});
