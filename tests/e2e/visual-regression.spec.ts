import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test('about page matches baseline', async ({ page }) => {
    await page.goto('/about');
    await expect(page).toHaveScreenshot('about-page.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  test('gallery page matches baseline', async ({ page }) => {
    await page.goto('/gallery');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('gallery-page.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  test('home page options form matches baseline', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('home-options.png', {
      maxDiffPixelRatio: 0.01,
    });
  });
});
