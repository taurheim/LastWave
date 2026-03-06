import type { StackPoint } from '../models/Peak';
import type { MeasureTextFn } from './util';
import Peak from '../models/Peak';
import Label from '../models/Label';
import { findOptimalLabel } from './bezierFit';

/*
  Returns true if the W algorithm should be used:
  "w1" "w2"
  \/    /\
  \/ or /\
*/
export function isWType(peak: Peak) {
  return (
    // "w1"
    peak.A.slope <= 0 &&
    peak.B.slope >= 0 &&
    peak.C.slope < 0 &&
    peak.D.slope > 0
  ) ||
  (
    // "w2"
    peak.A.slope > 0 &&
    peak.B.slope < 0 &&
    peak.C.slope > 0 &&
    peak.D.slope < 0
  );
}

/*
  Bezier-aware inscribed rectangle placement.
  Reconstructs the actual d3.curveMonotoneX curves from the Peak's boundary
  points and finds the largest text rectangle that fits via bisection search.
*/
export function getWLabel(peak: Peak, text: string, font: string, measureText: MeasureTextFn, stack?: StackPoint[], peakIndex?: number): Label | null {
  return findOptimalLabel(peak, text, font, measureText, stack, peakIndex);
}
