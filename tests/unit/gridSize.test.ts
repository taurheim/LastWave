import { describe, it, expect } from 'vitest';
import {
  getGridSpanClass,
  getVariedGridSpanClass,
  packImageSpans,
  IMAGES_PER_BATCH,
  GRID_COLS,
} from '@/core/gallery/gridSize';
import type { GridSpanClass } from '@/core/gallery/gridSize';

const SPAN_VALUE: Record<GridSpanClass, number> = { small: 1, wide: 2, triple: 3, full: 4 };

describe('getGridSpanClass', () => {
  it('returns "small" for portrait images (ratio < 1)', () => {
    expect(getGridSpanClass(600, 800)).toBe('small');
  });

  it('returns "small" for square-ish images (ratio 1–4)', () => {
    expect(getGridSpanClass(800, 600)).toBe('small');
    expect(getGridSpanClass(2000, 550)).toBe('small');
  });

  it('returns "wide" for moderately wide images (ratio 4–8)', () => {
    expect(getGridSpanClass(2400, 550)).toBe('wide');
    expect(getGridSpanClass(4000, 600)).toBe('wide');
  });

  it('returns "triple" for very wide images (ratio 8–15)', () => {
    expect(getGridSpanClass(4800, 550)).toBe('triple');
    expect(getGridSpanClass(7950, 600)).toBe('triple');
  });

  it('returns "full" for ultra-wide images (ratio >= 15)', () => {
    expect(getGridSpanClass(9000, 600)).toBe('full');
    expect(getGridSpanClass(50000, 600)).toBe('full');
  });

  it('returns "small" when width or height is 0 or missing', () => {
    expect(getGridSpanClass(0, 600)).toBe('small');
    expect(getGridSpanClass(800, 0)).toBe('small');
  });

  it('exports IMAGES_PER_BATCH as 12', () => {
    expect(IMAGES_PER_BATCH).toBe(12);
  });
});

describe('getVariedGridSpanClass', () => {
  it('never widens portrait images (ratio < 1)', () => {
    for (let i = 0; i < 100; i++) {
      expect(getVariedGridSpanClass(600, 800, i)).toBe('small');
    }
  });

  it('never widens nearly-square images (ratio < 1.2)', () => {
    for (let i = 0; i < 100; i++) {
      expect(getVariedGridSpanClass(700, 600, i)).toBe('small');
    }
  });

  it('returns "small" for zero dimensions regardless of index', () => {
    for (let i = 0; i < 20; i++) {
      expect(getVariedGridSpanClass(0, 600, i)).toBe('small');
      expect(getVariedGridSpanClass(800, 0, i)).toBe('small');
    }
  });

  it('produces a mix of small and wide for landscape images across indices', () => {
    const results = new Set<string>();
    for (let i = 0; i < 100; i++) {
      results.add(getVariedGridSpanClass(2000, 550, i));
    }
    expect(results.has('small')).toBe(true);
    expect(results.has('wide')).toBe(true);
  });

  it('produces a mix of small and wide for base-wide images across indices', () => {
    const results = new Set<string>();
    for (let i = 0; i < 100; i++) {
      results.add(getVariedGridSpanClass(2400, 550, i));
    }
    expect(results.has('small')).toBe(true);
    expect(results.has('wide')).toBe(true);
  });

  it('does not change triple or full spans', () => {
    for (let i = 0; i < 100; i++) {
      expect(getVariedGridSpanClass(4800, 550, i)).toBe('triple');
      expect(getVariedGridSpanClass(9000, 600, i)).toBe('full');
    }
  });

  it('is deterministic — same inputs always produce same output', () => {
    const a = getVariedGridSpanClass(2000, 550, 42);
    const b = getVariedGridSpanClass(2000, 550, 42);
    expect(a).toBe(b);
  });
});

describe('packImageSpans', () => {
  function totalSpan(spans: GridSpanClass[]): number {
    return spans.reduce((sum, s) => sum + SPAN_VALUE[s], 0);
  }

  /** Assert every row sums to GRID_COLS. */
  function assertRowsFull(spans: GridSpanClass[]) {
    let rowSum = 0;
    for (const s of spans) {
      rowSum += SPAN_VALUE[s];
      if (rowSum === GRID_COLS) {
        rowSum = 0;
      } else if (rowSum > GRID_COLS) {
        throw new Error(`Row overflows: sum reached ${rowSum}`);
      }
    }
    // Last row should also be full (padded)
    if (rowSum !== 0) {
      throw new Error(`Last row incomplete: sum is ${rowSum}, expected ${GRID_COLS}`);
    }
  }

  it('returns empty array for no images', () => {
    expect(packImageSpans([])).toEqual([]);
  });

  it('pads a single small image to fill one row', () => {
    const spans = packImageSpans([{ width: 800, height: 600 }]);
    expect(totalSpan(spans)).toBe(GRID_COLS);
  });

  it('pads a single full-width image to exactly one row', () => {
    const spans = packImageSpans([{ width: 9000, height: 600 }]);
    expect(spans).toEqual(['full']);
  });

  it('fills rows completely for 4 small images', () => {
    const imgs = Array.from({ length: 4 }, () => ({ width: 800, height: 600 }));
    const spans = packImageSpans(imgs);
    assertRowsFull(spans);
  });

  it('fills rows completely for a large mixed set', () => {
    const imgs = [
      { width: 800, height: 600 },   // small
      { width: 2400, height: 550 },   // wide
      { width: 4800, height: 550 },   // triple
      { width: 9000, height: 600 },   // full
      { width: 600, height: 800 },    // portrait
      { width: 2000, height: 550 },   // landscape
      { width: 4000, height: 600 },   // wide
      { width: 800, height: 600 },    // small
      { width: 800, height: 600 },    // small
      { width: 2400, height: 550 },   // wide
    ];
    const spans = packImageSpans(imgs);
    assertRowsFull(spans);
  });

  it('fills rows for many identical small images', () => {
    const imgs = Array.from({ length: 17 }, () => ({ width: 800, height: 600 }));
    const spans = packImageSpans(imgs);
    assertRowsFull(spans);
  });

  it('fills rows for many identical wide images', () => {
    const imgs = Array.from({ length: 7 }, () => ({ width: 2400, height: 550 }));
    const spans = packImageSpans(imgs);
    assertRowsFull(spans);
  });

  it('handles all-portrait images without gaps', () => {
    const imgs = Array.from({ length: 5 }, () => ({ width: 600, height: 800 }));
    const spans = packImageSpans(imgs);
    assertRowsFull(spans);
  });

  it('never exceeds GRID_COLS per row', () => {
    const imgs = Array.from({ length: 50 }, (_, i) => ({
      width: 800 + i * 200,
      height: 550,
    }));
    const spans = packImageSpans(imgs);
    let rowSum = 0;
    for (const s of spans) {
      rowSum += SPAN_VALUE[s];
      expect(rowSum).toBeLessThanOrEqual(GRID_COLS);
      if (rowSum === GRID_COLS) rowSum = 0;
    }
  });

  it('is deterministic', () => {
    const imgs = [
      { width: 800, height: 600 },
      { width: 2400, height: 550 },
      { width: 4800, height: 550 },
      { width: 600, height: 800 },
    ];
    const a = packImageSpans(imgs);
    const b = packImageSpans(imgs);
    expect(a).toEqual(b);
  });
});
