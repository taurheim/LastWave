/**
 * Shared types for wave text deformation.
 */
import Label from '../models/Label';
import type { MeasureTextFn } from './util';

export type { MeasureTextFn } from './util';

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

export type { Label };