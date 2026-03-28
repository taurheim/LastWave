export { findLabelIndices, createCanvasMeasurer } from './util';
export type { TextDimensions, MeasureTextFn } from './util';
export type { BandPoint, CharPlacement, DeformResult } from './types';
export type { WaveType } from './classifier';
export { classifyPeak, getLabel } from './classifier';
export { computeDeformedText } from './deformText';
export { buildBandLUT } from './overflowDetection';
export type { OverflowInfo } from './overflowDetection';
export { findOptimalLabel } from './bezierFit';
