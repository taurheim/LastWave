import DataSource from 'src/models/DataSource';
import Option from 'src/models/Option';
import SeriesData from 'src/models/SeriesData';
import async from 'async';
import jQuery from 'jquery';
import LastFmApi from './lastfm/LastFmApi';
import URLParameter from './lastfm/models/URLParameter';

import LastFmOptions from './lastfm/Options';
import ArtistTags from '@/datasources/lastfm/models/ArtistTags';
import { getTopTags, combineArtistTags, splitTimeSpan, joinSegments, DateStringToUnix, cleanByMinPlays, cleanByTopN } from './lastfm/util';
import TimeSpan from '@/datasources/lastfm/models/TimeSpan';
import SegmentData from '@/models/SegmentData';


export default class LastFm implements DataSource {
  title: string;
  api: LastFmApi;

  constructor() {
    this.title = "last.fm";
    this.api = new LastFmApi("27ca6b1a0750cf3fb3e1f0ec5b432b72");
  }

  loadData(options: any, callback: any): void {
    var unixStart = DateStringToUnix(options["time_start"]);
    var unixEnd = DateStringToUnix(options["time_end"]);
    var username = options["username"];
    var groupBy = options["group_by"];
    var minPlays = options["min_plays"];
    var method = options["method"];
    var useLocalStorage = options["use_localstorage"];
    var timeSpan = new TimeSpan(unixStart, unixEnd);
    var TAG_TOP_N_COUNT = 10;
    var self = this;

    // TODO error checking (date in future, etc.)
    // TODO instead of using localstorage as a request cache, make it smaller
    // by only caching the responses we care about (e.g. if we had a request for
    // RHCP plays, we would cache just the number of plays)
    var firstMethod = (method === "tag") ? "artist" : method;
    this.getDataForTimeSpan(username, firstMethod, groupBy, timeSpan, function(err: any, data: any) {
      switch(method) {
        case "artist":
        case "album":
          var cleanedData = cleanByMinPlays(data, minPlays);
          callback(err, cleanedData);
          break;
        case "tag":
          // Now that we have the artist data, we need to get the tags.
          self.getTagsForArtistData(data, useLocalStorage).then(tagData => {
            var cleanedData = cleanByTopN(tagData, TAG_TOP_N_COUNT);
            callback(err, cleanedData);
          });
          break;
        default:
          callback("Method not recognized: " + method);
      }
    });
  }

  getOptions(): Option[] {
    var today = new Date();
    var defaultStartDate = new Date();
    defaultStartDate.setDate(today.getDate() - 1);
    defaultStartDate.setMonth(today.getMonth() - 1);
    // defaultStartDate.setFullYear(today.getFullYear() - 1);

    // TODO there's definitely a better way to handle these options
    return LastFmOptions;
  }

  getTagsForArtistData(artistData: SeriesData[], useLocalStorage: boolean): Promise<SeriesData[]> {
    // TODO Promisify
    // TODO use config file
    var LAST_FM_API_CADENCE_MS = 150;
    var self = this;
    return new Promise((resolve) => {
      var count = 0;
      // Make an array of artists
      var artists = artistData.map(function(artistObject) {
        return artistObject.title;
      });
      var tagData: {[key: string]: ArtistTags} = {};

      async.eachLimit(
        artists,
        1, // LFM_CONCURRENT_API_REQUESTS
        function(artistName, callback) {
          count++;
          // $("#output").html(count + "/" + artists.length + " artist tags fetched.");

          var artistTags = new ArtistTags(artistName);

          // Check the cache if necessary
          if (useLocalStorage && artistTags.isInCache()) {
            artistTags.loadFromCache();
            tagData[artistName] = artistTags;
            return callback();
          }

          // Make the request
          var requestParams = [
            new URLParameter("artist", artistName),
          ];
          var requestURL = self.api.getAPIRequestURL("tag", requestParams);
          jQuery.get(requestURL, function(data) {
            if (!data.error) {
              var allTags = self.api.parseResponseJSON(data);
              var topTags = getTopTags(allTags);

              artistTags.setTags(topTags);
              tagData[artistName] = artistTags;

              if (useLocalStorage) {
                artistTags.cache();
              }
            }

            setTimeout(callback, LAST_FM_API_CADENCE_MS);
          }).fail(function(err) {
            // Ignore failures
            callback();
          });
        },
        function(err) {
          var combinedData = combineArtistTags(artistData, tagData);
          resolve(combinedData);
        }
      );
    });
  }

  getDataForTimeSpan(username: string, groupByCategory: string, groupByTime: string, timeSpan: TimeSpan, callback: any) {
    var timeSegments = splitTimeSpan(groupByTime, timeSpan);
    var count = 0;
    var segmentData: SegmentData[][] = [];
    var LAST_FM_API_CONCURRENT_REQUESTS = 1;
    var LAST_FM_API_CADENCE_MS = 150;
    var self = this;

    async.eachLimit(
      timeSegments,
      LAST_FM_API_CONCURRENT_REQUESTS,
      function (timeSegment, callback) {
        count++;
        $("#output").html(count + "/" + timeSegments.length + " time segments");
        // TODO cache old segments (but not new ones!)
        var params = [
          new URLParameter("user", username),
          new URLParameter("from", timeSegment.start.toString()),
          new URLParameter("to", timeSegment.end.toString()),
        ];
        var requestURL = self.api.getAPIRequestURL(groupByCategory, params);

        // Make the request
        $.get(requestURL, function(data) {
          if (!data.error) {
            // Parse through the data
            var parsedData = self.api.parseResponseJSON(data);
            segmentData.push(parsedData);
          }

          setTimeout(callback, LAST_FM_API_CADENCE_MS);
        }).fail(function(err) {
          // Ignore failures
          callback();
        });
      },
      function(err) {
        // All requests finished.
        var joinedSegments = joinSegments(segmentData);
        callback(err, joinedSegments);
      }
    );
  }
}
