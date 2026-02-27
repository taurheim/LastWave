import {
  DateStringToUnix,
  splitTimeSpan,
  joinSegments,
  cleanByMinPlays,
  cleanByTopN,
  getTopTags,
  combineArtistTags,
} from '@/core/lastfm/util';
import TimeSpan from '@/core/lastfm/models/TimeSpan';
import SegmentData from '@/core/models/SegmentData';
import type SeriesData from '@/core/models/SeriesData';
import ArtistTags from '@/core/lastfm/models/ArtistTags';

describe('DateStringToUnix', () => {
  it('converts a date string to unix timestamp in seconds', () => {
    // 2020-01-01T00:00:00.000Z => 1577836800
    const result = DateStringToUnix('2020-01-01T00:00:00.000Z');
    expect(result).toBe(1577836800);
  });

  it('converts another known date', () => {
    // 1970-01-01T00:00:00.000Z => 0
    const result = DateStringToUnix('1970-01-01T00:00:00.000Z');
    expect(result).toBe(0);
  });
});

describe('splitTimeSpan', () => {
  const WEEK = 604800;
  const MONTH = 2628000;

  it('splits a time span into weekly segments', () => {
    const span = new TimeSpan(0, WEEK * 4);
    const segments = splitTimeSpan('week', span);
    expect(segments).toHaveLength(4);
    expect(segments[0]).toBeInstanceOf(TimeSpan);
    expect(segments[0].start).toBe(0);
    expect(segments[0].end).toBe(WEEK);
  });

  it('splits a time span into monthly segments', () => {
    const span = new TimeSpan(0, MONTH * 3);
    const segments = splitTimeSpan('month', span);
    expect(segments).toHaveLength(3);
    expect(segments[1].start).toBe(MONTH);
    expect(segments[1].end).toBe(MONTH * 2);
  });

  it('returns correct number of segments for a given range', () => {
    const span = new TimeSpan(1000, 1000 + WEEK * 10);
    const segments = splitTimeSpan('week', span);
    expect(segments).toHaveLength(10);
  });
});

describe('joinSegments', () => {
  it('joins multiple SegmentData arrays into SeriesData array', () => {
    const seg1 = [new SegmentData('ArtistA', 5), new SegmentData('ArtistB', 3)];
    const seg2 = [new SegmentData('ArtistA', 10)];
    const result = joinSegments([seg1, seg2]);
    expect(result).toHaveLength(2);
  });

  it('each artist appears once with a counts array', () => {
    const seg1 = [new SegmentData('ArtistA', 5)];
    const seg2 = [new SegmentData('ArtistA', 10)];
    const result = joinSegments([seg1, seg2]);
    const artistA = result.find((r) => r.title === 'ArtistA');
    expect(artistA).toBeDefined();
    expect(artistA!.counts).toEqual([5, 10]);
  });

  it('artists not present in a segment get 0 for that index', () => {
    const seg1 = [new SegmentData('ArtistA', 5)];
    const seg2 = [new SegmentData('ArtistB', 7)];
    const result = joinSegments([seg1, seg2]);
    const artistA = result.find((r) => r.title === 'ArtistA');
    const artistB = result.find((r) => r.title === 'ArtistB');
    expect(artistA!.counts).toEqual([5, 0]);
    expect(artistB!.counts).toEqual([0, 7]);
  });
});

describe('cleanByMinPlays', () => {
  const data: SeriesData[] = [
    { title: 'High', counts: [10, 20, 30] },
    { title: 'Low', counts: [1, 2, 3] },
    { title: 'Mid', counts: [5, 5, 5] },
  ];

  it('removes artists with max play count below threshold', () => {
    const result = cleanByMinPlays(data, 10);
    expect(result.find((d) => d.title === 'Low')).toBeUndefined();
  });

  it('keeps artists at or above threshold', () => {
    const result = cleanByMinPlays(data, 5);
    expect(result).toHaveLength(2);
    expect(result.map((d) => d.title)).toContain('High');
    expect(result.map((d) => d.title)).toContain('Mid');
  });

  it('returns empty array when all below threshold', () => {
    const result = cleanByMinPlays(data, 100);
    expect(result).toEqual([]);
  });
});

describe('cleanByTopN', () => {
  it('keeps only top N artists by max play count', () => {
    const data: SeriesData[] = [
      { title: 'A', counts: [1, 2] },
      { title: 'B', counts: [10, 20] },
      { title: 'C', counts: [5, 15] },
    ];
    const result = cleanByTopN(data, 2);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('B');
    expect(result[1].title).toBe('C');
  });

  it('correctly sorts by max value', () => {
    const data: SeriesData[] = [
      { title: 'X', counts: [100] },
      { title: 'Y', counts: [50] },
      { title: 'Z', counts: [75] },
    ];
    const result = cleanByTopN(data, 3);
    expect(result[0].title).toBe('X');
    expect(result[1].title).toBe('Z');
    expect(result[2].title).toBe('Y');
  });

  it('works when N > data length', () => {
    const data: SeriesData[] = [
      { title: 'Only', counts: [5] },
    ];
    const result = cleanByTopN(data, 10);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Only');
  });
});

describe('getTopTags', () => {
  it('filters out "seen live" tag', () => {
    const tags = [
      new SegmentData('seen live', 100),
      new SegmentData('rock', 80),
    ];
    const result = getTopTags(tags);
    expect(result).not.toContain('seen live');
  });

  it('filters out tags with weight under 50', () => {
    const tags = [
      new SegmentData('rock', 80),
      new SegmentData('indie', 30),
    ];
    const result = getTopTags(tags);
    expect(result).not.toContain('indie');
  });

  it('keeps valid tags', () => {
    const tags = [
      new SegmentData('rock', 80),
      new SegmentData('electronic', 51),
    ];
    const result = getTopTags(tags);
    expect(result).toEqual(['rock', 'electronic']);
  });
});

describe('combineArtistTags', () => {
  it('combines artist play data with tag data into tag-based SeriesData', () => {
    const artistData: SeriesData[] = [
      { title: 'ArtistA', counts: [10, 20] },
    ];
    const tagA = new ArtistTags('ArtistA');
    tagA.setTags(['rock', 'indie']);
    const tagData = { ArtistA: tagA };

    const result = combineArtistTags(artistData, tagData);
    expect(result).toHaveLength(2);
    const rock = result.find((r) => r.title === 'rock');
    expect(rock).toBeDefined();
    expect(rock!.counts).toEqual([10, 20]);
  });

  it('tags accumulate play counts from all artists that have them', () => {
    const artistData: SeriesData[] = [
      { title: 'ArtistA', counts: [10, 20] },
      { title: 'ArtistB', counts: [5, 15] },
    ];
    const tagA = new ArtistTags('ArtistA');
    tagA.setTags(['rock']);
    const tagB = new ArtistTags('ArtistB');
    tagB.setTags(['rock', 'pop']);
    const tagData = { ArtistA: tagA, ArtistB: tagB };

    const result = combineArtistTags(artistData, tagData);
    const rock = result.find((r) => r.title === 'rock');
    const pop = result.find((r) => r.title === 'pop');
    expect(rock!.counts).toEqual([15, 35]);
    expect(pop!.counts).toEqual([5, 15]);
  });
});
