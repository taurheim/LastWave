/**
 * Shared types for wave text deformation.
 */

export interface BandPoint {
  x: number;
  topY: number;
  botY: number;
  centerY: number;
  thickness: number;
}

export interface CharPlacement {
  ch: string;
  x: number;
  y: number;
  fontSize: number;
  scaleY: number;
  angle: number;
  opacity: number;
  width: number;
}

export interface DeformResult {
  placements: CharPlacement[];
  overflowFraction: number;
  avgFontSizeRatio: number;
}