import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('can navigate between all pages', async ({ page }) => {
    await page.goto('/');

    await page.locator('nav >> text=About').click();
    await expect(page).toHaveURL('/about');
    await expect(page.locator('h1:has-text("What is LastWave?")')).toBeVisible();

    await page.locator('nav >> text=Gallery').click();
    await expect(page).toHaveURL('/gallery');

    await page.locator('nav >> text=Home').click();
    await expect(page).toHaveURL('/');
  });
});
