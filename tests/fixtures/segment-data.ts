import SegmentData from '../../src/core/models/SegmentData';

/** Two segments of artist data for joinSegments testing */
export const twoSegments: SegmentData[][] = [
  [
    new SegmentData('Radiohead', 45),
    new SegmentData('Pink Floyd', 32),
    new SegmentData('Tame Impala', 28),
  ],
  [
    new SegmentData('Radiohead', 30),
    new SegmentData('Pink Floyd', 15),
    new SegmentData('Boards of Canada', 10),
  ],
];

/** Three segments for more complex join testing */
export const threeSegments: SegmentData[][] = [
  [
    new SegmentData('Radiohead', 45),
    new SegmentData('Pink Floyd', 32),
  ],
  [
    new SegmentData('Radiohead', 30),
    new SegmentData('Tame Impala', 28),
  ],
  [
    new SegmentData('Pink Floyd', 20),
    new SegmentData('Tame Impala', 15),
  ],
];
