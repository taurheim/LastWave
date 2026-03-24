import TimeSpan from './models/TimeSpan';
import type SeriesData from '../models/SeriesData';
import SegmentData from '../models/SegmentData';

/**
 * Convert from date in format YY/MM/DD to unix timestamp
 */
export function DateStringToUnix(dateString: string) {
  return (new Date(dateString)).getTime() / 1000;
}

/*
  Split a time span into weeks/months.
  @param splitBy "month" or "week"
  @param timeSpan TimeSpan object with start/end unix timestamps
  @return Array of TimeSpan objects, each one corresponding to a week/month
*/
export function splitTimeSpan(splitBy: string, timeSpan: TimeSpan, logger?: (msg: string) => void) {
  const TIME_IN_SECONDS: { [key: string]: number } = {
    week: 604800,
    month: 2628000,
    day: 86400,
    year: 31536000,
  };
  const segments = [];
  const interval = TIME_IN_SECONDS[splitBy];
  for (let t = timeSpan.start; t < timeSpan.end; t += interval) {
    segments.push(new TimeSpan(t, t + interval));
  }

  logger?.(`Time span: ${timeSpan.start} to ${timeSpan.end}, split into ${segments.length} segments`);

  return segments;
}

export function combineArtistTags(artistData: SeriesData[], tagData: { [key: string]: { tags: string[] } }) {
  // Key: tag name
  // Value: {name: <string>, counts: [<int>]}
  const countsByTag: { [key: string]: SeriesData } = {};

  artistData.forEach((segment) => {
    const artistName = segment.title;
    const segmentCounts = segment.counts;
    const artistTags = tagData[artistName];

    // Sometimes we couldn't get tags
    if (!artistTags) {
      return;
    }

    // Go through every time segment
    for (let s = 0; s < segmentCounts.length; s++) {
      const segmentCount = segmentCounts[s];

      // Go through every tag
      artistTags.tags.forEach((tagName) => {
        if (!countsByTag[tagName]) {
          countsByTag[tagName] = {
            title: tagName,
            counts: new Array(segmentCounts.length + 1).join('0').split('').map(parseFloat),
          };
        }

        countsByTag[tagName].counts[s] += segmentCount;
      });
    }
  });

  // Turn our map into an array
  return Array.from(Object.keys(countsByTag).map((key) => {
    return countsByTag[key];
  }));
}

/*
  Each segment should be an array of objects:
  {
    name: <Name of artist/genre>
    count: <int>
  }

  which we will turn into an array of objects:
  {
    title: <Name of artist/genre>
    counts: [<int>]
  }
*/
export function joinSegments(segmentData: (SegmentData[] | undefined)[], logger?: (msg: string) => void): SeriesData[] {
  // Use a map to join the data
  const countsByName: { [key: string]: SeriesData } = {};

  segmentData.forEach((innerSegment, index) => {
    if (!innerSegment) return;  // Skip unfetched segments
    innerSegment.forEach((nameData) => {
      const name = nameData.title;
      const count = nameData.count;

      if (!countsByName[name]) {
        // Hasn't been added to the map yet
        // Fill count with 0s
        countsByName[name] = {
          title: name,
          counts: new Array(segmentData.length + 1).join('0').split('').map(parseFloat),
        };
      }

      countsByName[name].counts[index] = count;
    });
  });

  logger?.(`Joined ${segmentData.length} segments`);

  // Turn our map into an array
  return Array.from(Object.keys(countsByName).map((key) => {
    return countsByName[key];
  }));
}

/*
  Remove any artist/genre/etc. that has fewer than minPlays plays in its
  largest time segment.
*/
export function cleanByMinPlays(data: SeriesData[], minPlays: number, logger?: (msg: string) => void) {
  const cleanedData = data.filter((obj) => {
    let maxPlays = 0;
    obj.counts.forEach((playCount) => {
      if (playCount > maxPlays) {
        maxPlays = playCount;
      }
    });

    return maxPlays >= minPlays;
  });

  logger?.(`Before clean: ${data.length}, after clean: ${cleanedData.length}`);

  return cleanedData;
}

/*
  Find the optimal minimum-plays threshold so that:
  1. The peak number of active artists in any single time slice ≈ targetMaxConcurrent
  2. The number of completely empty time slices is minimised
*/
export function findOptimalMinPlays(
  data: SeriesData[],
  targetMaxConcurrent = 30,
  logger?: (msg: string) => void,
): number {
  if (data.length === 0) return 1;
  const numSegments = data[0].counts.length;
  if (numSegments === 0) return 1;

  // Pre-compute each artist's peak play count (the threshold at which they'd be removed)
  const peakCounts: number[] = data.map((s) => {
    let max = 0;
    for (const c of s.counts) {
      if (c > max) max = c;
    }
    return max;
  });

  // Only evaluate at the unique peak-count breakpoints (sorted ascending)
  const thresholds = [...new Set(peakCounts)].sort((a, b) => a - b);

  let bestMinPlays = 1;
  let bestScore = Infinity;

  for (const threshold of thresholds) {
    // Artists surviving this threshold
    const surviving: SeriesData[] = [];
    for (let i = 0; i < data.length; i++) {
      if (peakCounts[i] >= threshold) surviving.push(data[i]);
    }
    if (surviving.length === 0) break;

    // Count max concurrent active artists and empty slices
    let maxConcurrent = 0;
    let emptySlices = 0;
    for (let seg = 0; seg < numSegments; seg++) {
      let concurrent = 0;
      for (const s of surviving) {
        if (s.counts[seg] > 0) concurrent++;
      }
      if (concurrent > maxConcurrent) maxConcurrent = concurrent;
      if (concurrent === 0) emptySlices++;
    }

    // Score: distance from target concurrent + penalty for empty slices
    const score = Math.abs(maxConcurrent - targetMaxConcurrent) + emptySlices * 2;

    if (score < bestScore) {
      bestScore = score;
      bestMinPlays = threshold;
    }
  }

  logger?.(`Optimal min plays: ${bestMinPlays} (target concurrent: ${targetMaxConcurrent})`);
  return Math.max(bestMinPlays, 5);
}

/*
  Build a descending sequence of min-plays thresholds for the "build-up"
  loading animation.  Starts from a high threshold (few artists visible)
  and steps down to targetMinPlays (full chart).
*/
export function getAnimationSteps(
  data: SeriesData[],
  targetMinPlays: number,
  startArtistCount = 3,
  maxSteps = 15,
): number[] {
  if (data.length <= startArtistCount) return [targetMinPlays];

  // Each artist's peak play count, sorted descending
  const peakCounts = data.map((s) => {
    let max = 0;
    for (const c of s.counts) if (c > max) max = c;
    return max;
  }).sort((a, b) => b - a);

  // Start at the threshold where only ~startArtistCount artists survive
  const startThreshold = peakCounts[Math.min(startArtistCount - 1, peakCounts.length - 1)];
  if (startThreshold <= targetMinPlays) return [targetMinPlays];

  // Unique breakpoints between start and target, descending
  const breakpoints = [...new Set(peakCounts)]
    .filter((t) => t >= targetMinPlays && t <= startThreshold)
    .sort((a, b) => b - a);

  if (breakpoints.length <= maxSteps) return breakpoints;

  // Evenly sample maxSteps points
  const steps: number[] = [];
  for (let i = 0; i < maxSteps; i++) {
    const idx = Math.floor(i * (breakpoints.length - 1) / (maxSteps - 1));
    steps.push(breakpoints[idx]);
  }
  if (steps[steps.length - 1] !== targetMinPlays) {
    steps[steps.length - 1] = targetMinPlays;
  }
  return steps;
}

/*
  Only keep the top N groups
*/
export function cleanByTopN(data: SeriesData[], n: number) {
  data.sort((a, b) => {
    let maxA = 0;
    let maxB = 0;
    a.counts.forEach((_, i) => {
      if (a.counts[i] > maxA) {
        maxA = a.counts[i];
      }
      if (b.counts[i] > maxB) {
        maxB = b.counts[i];
      }
    });

    return maxB - maxA;
  });

  return data.slice(0, n);
}

/*
  @param allTags
    [
      {
        name: <tag name>,
        count: <tag weight>,
      }
    ]
  @return [<tag name>]
*/
export function getTopTags(allTags: SegmentData[]) {
  // TODO use config file
  const IGNORE_TAGS = [
    'seen live',
  ];
  const IGNORE_TAG_WEIGHT_UNDER = 50;
  const topTags: string[] = [];
  allTags.forEach((tag) => {
    // Make sure it's not on the blacklist
    if (
      IGNORE_TAGS.indexOf(tag.title) === -1 &&
      tag.count > IGNORE_TAG_WEIGHT_UNDER
    ) {
      topTags.push(tag.title);
    }
  });
  return topTags;
}
