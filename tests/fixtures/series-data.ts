import type SeriesData from '../../src/core/models/SeriesData';

/** Simple 3-artist, 5-week dataset for basic testing */
export const simpleSeriesData: SeriesData[] = [
  {
    title: 'Radiohead',
    counts: [10, 25, 45, 30, 15],
  },
  {
    title: 'Pink Floyd',
    counts: [20, 15, 10, 32, 28],
  },
  {
    title: 'Tame Impala',
    counts: [5, 12, 28, 20, 35],
  },
];

/** Larger dataset with 8 artists and 10 time segments for stress testing */
export const largeSeriesData: SeriesData[] = [
  {
    title: 'Radiohead',
    counts: [10, 25, 45, 30, 15, 20, 35, 40, 25, 10],
  },
  {
    title: 'Pink Floyd',
    counts: [20, 15, 10, 32, 28, 22, 18, 12, 8, 5],
  },
  {
    title: 'Tame Impala',
    counts: [5, 12, 28, 20, 35, 42, 38, 30, 22, 15],
  },
  {
    title: 'Boards of Canada',
    counts: [15, 18, 12, 8, 5, 10, 15, 20, 25, 30],
  },
  {
    title: 'Aphex Twin',
    counts: [8, 5, 3, 12, 18, 25, 20, 15, 10, 8],
  },
  {
    title: 'Sigur Ros',
    counts: [3, 8, 15, 20, 10, 5, 8, 12, 18, 22],
  },
  {
    title: 'Burial',
    counts: [12, 10, 8, 5, 3, 2, 5, 8, 12, 15],
  },
  {
    title: 'Four Tet',
    counts: [2, 5, 10, 15, 20, 25, 30, 28, 22, 18],
  },
];

/** Edge case: single artist */
export const singleArtistData: SeriesData[] = [
  {
    title: 'Radiohead',
    counts: [10, 25, 45, 30, 15],
  },
];

/** Edge case: all zeros except one peak */
export const spikeData: SeriesData[] = [
  {
    title: 'One Hit Wonder',
    counts: [0, 0, 50, 0, 0],
  },
  {
    title: 'Steady Eddie',
    counts: [10, 10, 10, 10, 10],
  },
];
