/**
 * E2E snapshot generation for the wave graph.
 *
 * Each test case:
 *  1. Intercepts Last.fm API calls and returns data from a cached fixture.
 *  2. Fills in the form (username, date preset, color scheme).
 *  3. Clicks Generate and waits for the SVG to render.
 *  4. Screenshots the SVG wrapper and saves it as a baseline.
 *
 * In CI these run with --update-snapshots, and any changes are committed
 * back to the PR branch for visual review in the diff.
 *
 * Run:       npx playwright test wave-snapshot.spec.ts
 * Update:    npx playwright test wave-snapshot.spec.ts --update-snapshots
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const FIXTURE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'fixtures',
  'wave-accuracy',
);

interface FixtureArtist {
  title: string;
  counts: number[];
}

interface FixtureData {
  username: string;
  numSegments: number;
  artists: FixtureArtist[];
}

/**
 * Build a Last.fm weekly-artist-chart JSON response for one time segment.
 * The response shape mirrors what ws.audioscrobbler.com returns.
 */
function buildSegmentResponse(fixture: FixtureData, segmentIndex: number) {
  const artists = fixture.artists
    .map((a) => ({
      name: a.title,
      playcount: String(a.counts[segmentIndex] ?? 0),
    }))
    .filter((a) => Number(a.playcount) > 0);

  return {
    weeklyartistchart: {
      artist: artists,
    },
  };
}

/**
 * Intercept all Last.fm API calls and serve fixture data.
 *
 * Pre-computes the exact segment timestamps the app will request (based on
 * FROZEN_NOW and the "Last year" preset), then maps each `from` parameter
 * to its deterministic fixture segment index. Responses are immediate —
 * no batching or debouncing needed.
 */
async function mockLastFmApi(page: import('@playwright/test').Page, fixture: FixtureData) {
  // Pre-compute the `from` timestamps the app will generate.
  // "Last year" preset: offset = 31536000s, group_by = month (2628000s)
  const nowSec = Math.floor(FROZEN_NOW / 1000);
  const yearOffsetSec = 31536000;
  const monthIntervalSec = 2628000;
  const startSec = nowSec - yearOffsetSec;

  const expectedFroms: number[] = [];
  for (let t = startSec; t < nowSec; t += monthIntervalSec) {
    expectedFroms.push(t);
  }

  // Map each expected `from` to a fixture segment index, scaling to fixture size
  const fromToSegIdx = new Map<string, number>();
  const numExpected = expectedFroms.length;
  for (let i = 0; i < numExpected; i++) {
    const segIdx = Math.round((i / Math.max(numExpected - 1, 1)) * (fixture.numSegments - 1));
    fromToSegIdx.set(String(expectedFroms[i]), segIdx);
  }

  await page.route('**/ws.audioscrobbler.com/**', (route) => {
    const url = new URL(route.request().url());
    const fromParam = url.searchParams.get('from') ?? '0';

    // Look up pre-computed index, fall back to 0 for unexpected `from` values
    const segIdx = fromToSegIdx.get(fromParam) ?? 0;

    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(buildSegmentResponse(fixture, segIdx)),
    });
  });
}

/**
 * Fixed timestamp for Date.now() override.
 * By freezing the clock, "Last year" always produces the same date range,
 * yielding identical segment boundaries across test runs.
 * 2025-04-01T00:00:00Z = 1743465600000
 */
const FROZEN_NOW = 1743465600000;

/**
 * System font to use instead of Google Fonts (DM Sans).
 * Liberation Sans is pre-installed in the Playwright Docker container,
 * eliminating the font-loading race that caused non-deterministic text
 * measurements and deformed text placement.
 */
const TEST_FONT = 'Liberation Sans';

/**
 * Mock Google Fonts CDN so no network requests are needed for fonts.
 * Maps any requested font family to the local system font, ensuring
 * canvas measureText and SVG text rendering use the same font instantly.
 */
async function mockGoogleFonts(page: import('@playwright/test').Page) {
  await page.route('**/fonts.googleapis.com/**', (route) => {
    route.fulfill({
      contentType: 'text/css',
      body: `@font-face { font-family: 'DM Sans'; src: local('${TEST_FONT}'); }`,
    });
  });
  await page.route('**/fonts.gstatic.com/**', (route) => route.abort());
}

interface WaveTestCase {
  fixture: string; // filename without .json
  scheme: string;
}

const TEST_CASES: WaveTestCase[] = [
  { fixture: 'Taurheim', scheme: 'mosaic' },
  { fixture: 'grimmless', scheme: 'lastwave' },
  { fixture: 'BeensVonBenis', scheme: 'ember' },
  { fixture: 'cwalkpinoy', scheme: 'ocean' },
  { fixture: 'spaceBass13', scheme: 'budapest' },
];

test.describe('Wave Graph Snapshots', () => {
  // Use a fixed viewport so screenshots are deterministic
  test.use({ viewport: { width: 1280, height: 900 } });

  // These tests are slow (data fetch + animation + deformed text placement)
  test.setTimeout(120_000);

  // Run sequentially — each test generates a full wave graph, and the dev server
  // can struggle with multiple simultaneous heavy renders.
  test.describe.configure({ mode: 'serial' });

  for (const tc of TEST_CASES) {
    test(`${tc.fixture} / ${tc.scheme}`, async ({ page }) => {
      const fixturePath = path.join(FIXTURE_DIR, `${tc.fixture}.json`);
      if (!fs.existsSync(fixturePath)) {
        test.skip(true, `Fixture ${tc.fixture}.json not found`);
        return;
      }
      const fixture: FixtureData = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

      // Set up API and font mocking before navigating
      await mockLastFmApi(page, fixture);
      await mockGoogleFonts(page);

      // Override Date.now() so "Last year" always produces the same date range.
      // Only Date.now() is frozen — timers (setTimeout, rAF) run normally.
      await page.addInitScript(`{
        Date.now = () => ${FROZEN_NOW};
      }`);

      // Navigate to home page
      await page.goto('/');

      // Wait for the form to be ready
      await page.getByRole('button', { name: 'Generate' }).waitFor({ timeout: 15_000 });

      // Set font to a local system font via the Zustand store so canvas
      // measureText and SVG text rendering use the same pre-installed font.
      // Disable loading animation to bypass the streaming color assignment
      // race (lockedColorMap depends on microtask-nondeterministic segment
      // arrival order in pooled()). Without animation, colors are computed
      // fresh from the final deterministic data.
      await page.evaluate((font) => {
        const store = (window as unknown as Record<string, any>).__lastwave_store;
        store?.getState().setRendererOption('font', font);
        store?.getState().setRendererOption('loading_animation', false);
      }, TEST_FONT);

      // Wait for the form to be ready
      await page.getByRole('button', { name: 'Generate' }).waitFor({ timeout: 15_000 });

      // Fill in username
      const usernameInput = page.locator('input[type="search"]');
      await usernameInput.fill(fixture.username);

      // Select "Last year" date preset (uses monthly segments, ~12 segments)
      await page.locator('select').first().selectOption({ label: 'Last year' });

      // Select color scheme by clicking the theme button
      await page
        .locator(`button`, { has: page.locator(`img[alt="${tc.scheme} theme preview"]`) })
        .click();

      // Click Generate
      await page.getByRole('button', { name: 'Generate' }).click();

      // The form hides and data fetching begins.
      // Wait for the visualization wrapper to appear (showVisualization becomes true)
      // There are two #svg-wrapper elements (desktop + mobile); use .first() for desktop
      const svgWrapper = page.locator('#svg-wrapper').first();
      await svgWrapper.waitFor({ state: 'visible', timeout: 45_000 });

      // Wait for deformed text placement to complete.
      // The app shows a "Placing text…" progress indicator while computing
      // deformed labels. Wait for it to appear (text placement started) then
      // disappear (text placement finished). This is more reliable than
      // counting <text> elements, which can be fooled by axis labels
      // stabilizing before artist labels begin computing.
      const svgElement = svgWrapper.locator('svg').first();
      // Wait for the desktop "Placing text" indicator to appear then disappear.
      // There are two (desktop + mobile), so scope to the desktop wrapper's parent.
      const desktopSection = page.locator('.hidden.lg\\:block');
      const placingTextIndicator = desktopSection.getByText(/Placing text/);
      await placingTextIndicator.waitFor({ state: 'visible', timeout: 90_000 });
      await placingTextIndicator.waitFor({ state: 'hidden', timeout: 90_000 });

      // Extra settle for any final paint
      await page.waitForTimeout(1000);

      // Hide overlay buttons (Full Size, Customize, loading status) before screenshot
      await page.evaluate(() => {
        document.querySelectorAll('#svg-wrapper').forEach((wrapper) => {
          const parent = wrapper.closest('.relative');
          if (!parent) return;
          // Hide all absolutely-positioned overlays
          parent.querySelectorAll(':scope > .absolute, :scope > div > .absolute').forEach((el) => {
            (el as HTMLElement).style.display = 'none';
          });
        });
      });

      // Screenshot just the SVG element (not the wrapper with overlay buttons)
      await expect(svgElement).toHaveScreenshot(`wave-${tc.fixture}-${tc.scheme}.png`, {
        maxDiffPixelRatio: 0.02,
      });
    });
  }
});
