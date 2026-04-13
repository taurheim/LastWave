export const IMAGES_PER_BATCH = 12;

export type GridSpanClass = 'small' | 'wide' | 'triple' | 'full';

export function getGridSpanClass(width: number, height: number): GridSpanClass {
  if (!width || !height) return 'small';
  const ratio = width / height;
  if (ratio >= 15) return 'full';
  if (ratio >= 8) return 'triple';
  if (ratio >= 4) return 'wide';
  return 'small';
}
