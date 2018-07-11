import TimeSpan from './models/TimeSpan';
import SeriesData from '@/models/SeriesData';
import SegmentData from 'src/models/SegmentData';
import ArtistTags from './models/ArtistTags';

/**
 * Convert from date in format YY/MM/DD to unix timestamp
 */
export function DateStringToUnix(dateString: string) {
  return (new Date(dateString)).getTime() / 1000;
}

  /*
    Make a call to the last.fm api.
    @param method
    @param additionalParams
    @return url
  */

  /*
    Split a time span into weeks/months.
    @param splitBy "month" or "week"
    @param unixStart Unix timestamp for the start of the time span
    @param unixEnd Unix timestmap for the end of the time span
    @return Array of TimeSpan objects, each one corresponding to a week/month
  */
export function splitTimeSpan(splitBy: string, timeSpan: TimeSpan) {
  const TIME_IN_SECONDS: { [key:string]: number} = {
    week: 604800,
    month: 2628000,
  };
  let segments = [];
  let interval = TIME_IN_SECONDS[splitBy];
  for (var t = timeSpan.start; t < timeSpan.end; t += interval) {
    segments.push(new TimeSpan(t, t + interval));
  }

  console.log("Time span: " + timeSpan.start + " to " + timeSpan.end);
  console.log("Split into " + segments.length + " segments");

  return segments;
}

export function combineArtistTags(artistData: SeriesData[], tagData: {[key: string]: ArtistTags}) {
    // Key: tag name
    // Value: {name: <string>, counts: [<int>]}
    var countsByTag: {[key: string]: SeriesData} = {};

    for(var i = 0; i < artistData.length; i++) {
      var artistName = artistData[i].title;
      var segmentCounts = artistData[i].counts;
      var artistTags = tagData[artistName];

      // Sometimes we couldn't get tags
      if (!artistTags) {
        continue;
      }
      
      // Go through every time segment
      for(var s = 0; s < segmentCounts.length; s++) {
        var segmentCount = segmentCounts[s];

        // Go through every tag
        for (var t = 0; t < artistTags.tags.length; t++) {
          var tagName = artistTags.tags[t];

          if (!countsByTag[tagName]) {
            countsByTag[tagName] = {
              title: tagName,
              counts: new Array(segmentCounts.length+1).join('0').split('').map(parseFloat),
            }
          }

          countsByTag[tagName].counts[s] += segmentCount;
        }
      }
    }

    // Turn our map into an array
    return Array.from(Object.keys(countsByTag).map(key => {
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

    // TODO I can probably do this with some fancy map/reduce
  */
export function joinSegments(segmentData: SegmentData[][]): SeriesData[] {
    // Use a map to join the data
    var countsByName: {[key: string]: SeriesData} = {};

    for (var s = 0; s < segmentData.length; s++) {
      for (var n = 0; n < segmentData[s].length; n++) {
        var nameData = segmentData[s][n];
        var name = nameData.title;
        var count = nameData.count;

        if (!countsByName[name]) {
          // Hasn't been added to the map yet
          // Fill count with 0s
          countsByName[name] = {
            title: name,
            counts: new Array(segmentData.length+1).join('0').split('').map(parseFloat),
          }
        }

        countsByName[name].counts[s] = count;
      }
    }

    console.log("Joined " + segmentData.length + " segments");

    // Turn our map into an array
    return Array.from(Object.keys(countsByName).map(key => {
      return countsByName[key];
    }));
  }

  /*
    Remove any artist/genre/etc. that has fewer than minPlays plays in its
    largest time segment.
    Assume data in format:
    [
      {
        name: <string>
        counts: [<int>]
      }
    ]
  */
export function cleanByMinPlays(data: SeriesData[], minPlays: number) {
    console.log("Before clean: " + data.length);
    var cleanedData = data.filter(function(obj) {
      var maxPlays = 0;
      for (var i = 0; i < obj.counts.length; i++) {
        var playCount = obj.counts[i];
        if(playCount > maxPlays) maxPlays = playCount;
      }

      return maxPlays >= minPlays;
    });
    console.log("After clean: " + cleanedData.length);

    return cleanedData;
  }

  /*
    Only keep the top N groups
  */
export function cleanByTopN(data: SeriesData[], n: number) {
    data.sort(function(a, b) {
      var maxA = 0;
      var maxB = 0;
      for (var i = 0; i < a.counts.length; i++) {
        if (a.counts[i] > maxA) maxA = a.counts[i];
        if (b.counts[i] > maxB) maxB = b.counts[i];
      }

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
  var IGNORE_TAGS = [
    "seen live",
  ];
  var IGNORE_TAG_WEIGHT_UNDER = 50;
    var topTags = [];
    for (var i = 0; i < allTags.length; i++) {
      var tag = allTags[i];

      // Make sure it's not on the blacklist
      if (
        IGNORE_TAGS.indexOf(tag.title) === -1 &&
        tag.count > IGNORE_TAG_WEIGHT_UNDER
      ) {
        topTags.push(tag.title);
      }
    }
    return topTags;
  }