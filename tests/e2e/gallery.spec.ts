import { test, expect } from '@playwright/test';

test.describe('Gallery Page', () => {
  test('loads gallery page with pagination buttons', async ({ page }) => {
    await page.goto('/gallery');
    await expect(page.getByRole('heading', { name: 'LastWave' })).toBeVisible();
    await expect(page.getByRole('button', { name: '← Previous' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next →' })).toBeVisible();
  });
});
