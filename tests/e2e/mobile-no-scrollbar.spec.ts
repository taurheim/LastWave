import { test, expect } from '@playwright/test';

const IPHONE_12_PRO = { width: 390, height: 844 };

test.describe('Mobile no-scrollbar', () => {
  test.use({ viewport: IPHONE_12_PRO });

  test('homepage has no horizontal scrollbar on iPhone 12 Pro', async ({ page }) => {
    await page.goto('/');
    const hasHScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHScroll).toBe(false);
  });

  test('no "Full size" button is shown on mobile', async ({ page }) => {
    await page.goto('/');
    // The Full size button should not exist in the mobile layout
    await expect(page.locator('text=Full size')).toHaveCount(0);
  });

  test('gallery page has no horizontal scrollbar on iPhone 12 Pro', async ({ page }) => {
    await page.goto('/gallery');
    const hasHScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHScroll).toBe(false);
  });

  test('about page has no horizontal scrollbar on iPhone 12 Pro', async ({ page }) => {
    await page.goto('/about');
    const hasHScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHScroll).toBe(false);
  });
});
