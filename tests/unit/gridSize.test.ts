import { describe, it, expect } from 'vitest';
import { getGridSpanClass, IMAGES_PER_BATCH } from '@/core/gallery/gridSize';

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
