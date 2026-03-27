import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('loads and shows the LastWave title', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'LastWave' })).toBeVisible();
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
    await expect(page.getByRole('textbox', { name: 'Enter your username' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Generate' })).toBeVisible();
  });
});
