import type { StackPoint } from '../models/Peak';
import type { MeasureTextFn } from './util';
import Peak from '../models/Peak';
import Label from '../models/Label';
import { findOptimalLabel } from './bezierFit';

export type WaveType = 'W' | 'X' | 'Y' | 'Z' | null;

/**
 * Classify a peak's slope pattern into one of the four wave types.
 *
 * W: alternating slopes (valley/ridge)
 * X: all slopes same sign (monotone tilt)
 * Y: mixed asymmetric patterns
 * Z: symmetric bowl / inverted bowl
 *
 * Returns null for unclassified peaks (narrow constriction points
 * where text placement would be poor).
 */
export function classifyPeak(peak: Peak): WaveType {
  const { A, B, C, D } = peak;

  // W: alternating slope patterns
  if (
    (A.slope <= 0 && B.slope >= 0 && C.slope < 0 && D.slope > 0) ||
    (A.slope > 0 && B.slope < 0 && C.slope > 0 && D.slope < 0)
  ) return 'W';

  // Z: symmetric bowl patterns (check before Y — Z is more specific)
  if (
    (A.slope >= 0 && B.slope <= 0 && C.slope <= 0 && D.slope >= 0) ||
    (A.slope === 0 && B.slope === 0 && C.slope > 0 && D.slope > 0)
  ) return 'Z';

  // Y: mixed asymmetric patterns
  if (
    (A.slope > 0 && B.slope < 0 && C.slope > 0 && D.slope >= 0) ||
    (A.slope > 0 && B.slope < 0 && C.slope <= 0 && D.slope < 0) ||
    (A.slope < 0 && B.slope <= 0 && C.slope < 0 && D.slope > 0) ||
    (A.slope >= 0 && B.slope > 0 && C.slope < 0 && D.slope > 0)
  ) return 'Y';

  // X: all slopes same sign (monotone tilt)
  if (
    (A.slope <= 0 && B.slope <= 0 && C.slope <= 0 && D.slope <= 0) ||
    (A.slope >= 0 && B.slope >= 0 && C.slope >= 0 && D.slope >= 0)
  ) return 'X';

  return null;
}

/**
 * Bezier-aware inscribed rectangle placement.
 * Reconstructs d3.curveMonotoneX curves from the Peak's boundary
 * points and finds the largest text rectangle that fits via bisection.
 */
export function getLabel(
  peak: Peak, text: string, font: string, measureText: MeasureTextFn,
  stack?: StackPoint[], peakIndex?: number,
): Label | null {
  return findOptimalLabel(peak, text, font, measureText, stack, peakIndex);
}