import { test, expect } from '@playwright/test';

test.describe('About Page', () => {
  test('displays about content', async ({ page }) => {
    await page.goto('/about');
    await expect(page.locator('h1:has-text("What is LastWave?")')).toBeVisible();
    await expect(page.locator('h2:has-text("Who built LastWave?")')).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: 'Niko Savas' })).toBeVisible();
  });

  test('has navigation back to home', async ({ page }) => {
    await page.goto('/about');
    await page.locator('nav >> text=Home').click();
    await expect(page).toHaveURL('/');
  });
});
