export const IMAGES_PER_BATCH = 12;

export type GridSpanClass = 'small' | 'wide' | 'triple' | 'full';

/** Base span from pure aspect ratio — no variety applied. */
export function getGridSpanClass(width: number, height: number): GridSpanClass {
  if (!width || !height) return 'small';
  const ratio = width / height;
  if (ratio >= 15) return 'full';
  if (ratio >= 8) return 'triple';
  if (ratio >= 4) return 'wide';
  return 'small';
}

/**
 * Simple deterministic hash (0–1) from an integer seed.
 * Only needs to look "random enough" for visual variety.
 */
function hashSeed(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Like getGridSpanClass but introduces deterministic width variety so the
 * gallery doesn't look uniform.  Portrait / square images are never widened.
 *
 * Rules:
 *  - ratio < 1 (portrait)  → always small (never crop wider)
 *  - ratio 1–4 (landscape) → ~35% chance of "wide" (crop to 2-col)
 *  - ratio 4–8 (wide)      → ~25% chance of "small" (crop tighter)
 *  - triple / full          → unchanged (already distinctive)
 */
export function getVariedGridSpanClass(
  width: number,
  height: number,
  index: number,
): GridSpanClass {
  const base = getGridSpanClass(width, height);
  if (!width || !height) return base;

  const ratio = width / height;
  const h = hashSeed(index);

  if (base === 'small' && ratio >= 1.2 && h < 0.35) return 'wide';
  if (base === 'wide' && h < 0.25) return 'small';

  return base;
}
