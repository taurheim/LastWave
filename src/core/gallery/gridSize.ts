export const IMAGES_PER_BATCH = 12;
export const GRID_COLS = 4;

export type GridSpanClass = 'small' | 'wide' | 'triple' | 'full';

const SPAN_VALUE: Record<GridSpanClass, number> = { small: 1, wide: 2, triple: 3, full: 4 };
const VALUE_TO_SPAN: GridSpanClass[] = [
  'small', // 0 (unused)
  'small', // 1
  'wide', // 2
  'triple', // 3
  'full', // 4
];

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

/**
 * Maximum column span an image should be expanded to.
 * Portrait images (ratio < 1) are capped at 1 to avoid ugly stretching.
 */
function maxSpan(width: number, height: number): number {
  if (!width || !height) return 1;
  return width / height < 1 ? 1 : GRID_COLS;
}

/**
 * Assigns column spans to a list of images so that every row sums to
 * exactly GRID_COLS, eliminating empty grid cells.
 *
 * Strategy:
 *  1. Compute ideal (varied) span per image.
 *  2. Process left-to-right, clamping each span to fit remaining row space.
 *  3. When the last image in a row can't fill the gap (e.g. portrait),
 *     walk backwards and widen the nearest eligible image.
 */
export function packImageSpans(images: Array<{ width: number; height: number }>): GridSpanClass[] {
  if (images.length === 0) return [];

  const ideal = images.map(
    (img, i) => SPAN_VALUE[getVariedGridSpanClass(img.width, img.height, i)],
  );
  const max = images.map((img) => maxSpan(img.width, img.height));
  const spans = new Array<number>(images.length);

  let remaining = GRID_COLS;
  let rowStart = 0;

  for (let i = 0; i < images.length; i++) {
    let span = Math.min(ideal[i], remaining, max[i]);
    span = Math.max(span, 1);

    spans[i] = span;
    remaining -= span;

    // Row full — start a new one
    if (remaining <= 0) {
      remaining = GRID_COLS;
      rowStart = i + 1;
      continue;
    }

    // If this is the last image overall and the row isn't full, pad it
    if (i === images.length - 1 && remaining > 0) {
      fillRowGap(spans, max, rowStart, i, remaining);
      remaining = 0;
    }
  }

  return spans.map((v) => VALUE_TO_SPAN[Math.min(v, GRID_COLS)]);
}

/** Distribute `gap` extra columns among items in [rowStart..rowEnd]. */
function fillRowGap(
  spans: number[],
  max: number[],
  rowStart: number,
  rowEnd: number,
  gap: number,
): void {
  let left = gap;
  // Prefer expanding from the end of the row backwards
  for (let j = rowEnd; j >= rowStart && left > 0; j--) {
    const add = Math.min(max[j] - spans[j], left);
    spans[j] += add;
    left -= add;
  }
  // If gap remains (all portraits), just expand the last non-portrait anyway
  if (left > 0) {
    spans[rowEnd] += left;
  }
}
