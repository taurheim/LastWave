import TimeSpan from './models/TimeSpan';
import type SeriesData from '../models/SeriesData';
import SegmentData from '../models/SegmentData';
import type ArtistTags from './models/ArtistTags';

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

export function combineArtistTags(artistData: SeriesData[], tagData: { [key: string]: ArtistTags }) {
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
export function joinSegments(segmentData: SegmentData[][], logger?: (msg: string) => void): SeriesData[] {
  // Use a map to join the data
  const countsByName: { [key: string]: SeriesData } = {};

  segmentData.forEach((innerSegment, index) => {
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
