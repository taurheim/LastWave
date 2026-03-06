import type { MeasureTextFn } from './util';
import Peak from '../models/Peak';
import Label from '../models/Label';
import { findOptimalLabel } from './bezierFit';

/*
  Returns true if the Y algorithm should be used:
  "y1" "y2" "y3" "y4"
  /\    /\  \\   //
  // or \\  \/   \/
*/
export function isYType(peak: Peak) {
  return (
    // y1
    peak.A.slope > 0 &&
    peak.B.slope < 0 &&
    peak.C.slope > 0 &&
    peak.D.slope >= 0
  ) ||
    (
      // y2
      peak.A.slope > 0 &&
      peak.B.slope < 0 &&
      peak.C.slope <= 0 &&
      peak.D.slope < 0
    ) ||
    (
      // y3
      peak.A.slope < 0 &&
      peak.B.slope <= 0 &&
      peak.C.slope < 0 &&
      peak.D.slope > 0
    ) ||
    (
      // y4
      peak.A.slope >= 0 &&
      peak.B.slope > 0 &&
      peak.C.slope < 0 &&
      peak.D.slope > 0
    );
}

/*
  Bezier-aware inscribed rectangle placement.
  Reconstructs the actual d3.curveMonotoneX curves from the Peak's boundary
  points and finds the largest text rectangle that fits via bisection search.
*/
export function getYLabel(peak: Peak, text: string, font: string, measureText: MeasureTextFn): Label | null {
  return findOptimalLabel(peak, text, font, measureText);
}
