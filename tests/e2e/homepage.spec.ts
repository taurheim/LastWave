import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('loads and shows the LastWave title', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=LastWave')).toBeVisible();
    await expect(page.locator('text=Graph your music listening history!')).toBeVisible();
  });

  test('shows navigation links', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav >> text=Home')).toBeVisible();
    await expect(page.locator('nav >> text=Gallery')).toBeVisible();
    await expect(page.locator('nav >> text=About')).toBeVisible();
  });

  test('shows the options form with username input and submit button', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input[placeholder="Enter your last.fm username"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]:has-text("Submit")')).toBeVisible();
  });
});
