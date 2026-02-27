import { test, expect } from '@playwright/test';

test.describe('Gallery Page', () => {
  test('loads gallery page with pagination buttons', async ({ page }) => {
    await page.goto('/gallery');
    await expect(page.locator('text=LastWave')).toBeVisible();
    await expect(page.locator('button:has-text("Previous Page")')).toBeVisible();
    await expect(page.locator('button:has-text("Next Page")')).toBeVisible();
  });
});
