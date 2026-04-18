/**
 * E2E visual-regression snapshots for the wave graph.
 *
 * Each test case:
 *  1. Intercepts Last.fm API calls and returns data from a cached fixture.
 *  2. Fills in the form (username, date preset, color scheme).
 *  3. Clicks Generate and waits for the SVG to render.
 *  4. Screenshots the SVG wrapper and compares against a stored baseline.
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

      // Set up API mocking before navigating
      await mockLastFmApi(page, fixture);

      // Override Date.now() so "Last year" always produces the same date range.
      // Only Date.now() is frozen — timers (setTimeout, rAF) run normally.
      await page.addInitScript(`{
        Date.now = () => ${FROZEN_NOW};
      }`);

      // Navigate to home page
      await page.goto('/');

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

      // Wait for render to fully complete. The app shows "Placing text N/M…" while
      // rendering deformed text via requestAnimationFrame. When done, drawingStatus
      // clears and the status overlay disappears. We wait for the "Placing text" text
      // to appear first, then for it to disappear.
      const placingText = page.locator('text=Placing text').first();
      try {
        await placingText.waitFor({ state: 'visible', timeout: 30_000 });
        // Now wait for it to disappear (render complete)
        await placingText.waitFor({ state: 'hidden', timeout: 60_000 });
      } catch {
        // Might have completed too fast to catch the "Placing text" state
      }

      // Extra settle for any final paint
      await page.waitForTimeout(500);

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
      const svgElement = svgWrapper.locator('svg').first();
      await expect(svgElement).toHaveScreenshot(`wave-${tc.fixture}-${tc.scheme}.png`, {
        maxDiffPixelRatio: 0.01,
      });
    });
  }
});
