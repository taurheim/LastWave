import { describe, it, expect } from 'vitest';
import { getGridSpanClass, getVariedGridSpanClass, IMAGES_PER_BATCH } from '@/core/gallery/gridSize';

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
