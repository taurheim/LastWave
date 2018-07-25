import DataSource from 'src/models/DataSource';
import SeriesData from 'src/models/SeriesData';
import LoadingStage from '@/models/LoadingStage';
import async from 'async';
import jQuery from 'jquery';
import LastFmApi from './lastfm/LastFmApi';
import URLParameter from './lastfm/models/URLParameter';
import Option from '@/models/Option';

import LastFmOptions from './lastfm/Options';
import ArtistTags from '@/datasources/lastfm/models/ArtistTags';
import {
  getTopTags,
  combineArtistTags,
  splitTimeSpan,
  joinSegments,
  DateStringToUnix,
  cleanByMinPlays,
  cleanByTopN,
} from './lastfm/util';
import TimeSpan from '@/datasources/lastfm/models/TimeSpan';
import SegmentData from '@/models/SegmentData';
import store from '@/store';

export default class LastFm implements DataSource {
  public title: string;
  private api: LastFmApi;
  private dataCache: any = {};

  constructor() {
    this.title = 'last.fm';
    this.api = new LastFmApi('27ca6b1a0750cf3fb3e1f0ec5b432b72');
  }

  public loadData(options: any, callback: any): void {
    const unixStart = DateStringToUnix(options.time_start);
    const unixEnd = DateStringToUnix(options.time_end);
    const username = options.username;
    const groupBy = options.group_by;
    const minPlays = options.min_plays;
    const method = options.method;
    const useLocalStorage = options.use_localstorage;
    const timeSpan = new TimeSpan(unixStart, unixEnd);
    const TAG_TOP_N_COUNT = 10;
    const self = this;

    const cachedData = this.getCachedData(options);
    if (cachedData) {
      console.log('Found cached data');
      // Need to progress the stages
      this.getLoadingStages(options).forEach(() => {
        store.commit('startNextStage', 1);
        store.commit('progressCurrentStage');
      });
      callback(null, cachedData);
      return;
    }

    // TODO error checking (date in future, etc.)

    const firstMethod = (method === 'tag') ? 'artist' : method;

    this.getDataForTimeSpan(username, firstMethod, groupBy, timeSpan, (err: any, data: any) => {
      switch (method) {
        case 'artist':
        case 'album':
          const cleanedData = cleanByMinPlays(data, minPlays);
          this.cacheData(options, cleanedData);
          callback(err, cleanedData);
          break;
        case 'tag':
          // Now that we have the artist data, we need to get the tags.
          self.getTagsForArtistData(data, useLocalStorage).then((tagData) => {
            const cleanedData = cleanByTopN(tagData, TAG_TOP_N_COUNT);
            this.cacheData(options, cleanedData);
            callback(err, cleanedData);
          });
          break;
        default:
          callback(`Method not recognized: ${method}`);
      }
    });
  }

  public getOptions(): Option[] {
    var today = new Date();
    var defaultStartDate = new Date();
    defaultStartDate.setDate(today.getDate() - 1);
    defaultStartDate.setMonth(today.getMonth() - 1);
    // defaultStartDate.setFullYear(today.getFullYear() - 1);

    // TODO there's definitely a better way to handle these options
    return LastFmOptions;
  }

  public getLoadingStages(options: any): LoadingStage[] {
    switch (options.method) {
      case "tag":
        return [

        ];
        break;
      case "artist":
      case "album":
        return [
          new LoadingStage(
            "Getting data...",
            100,
          )
        ];
        break;
      default:
        return [];
    }
  }

  private getTagsForArtistData(artistData: SeriesData[], useLocalStorage: boolean): Promise<SeriesData[]> {
    // TODO Promisify
    // TODO use config file
    var LAST_FM_API_CADENCE_MS = 150;
    var self = this;
    return new Promise((resolve) => {
      var count = 0;
      // Make an array of artists
      var artists = artistData.map(function (artistObject) {
        return artistObject.title;
      });
      var tagData: { [key: string]: ArtistTags } = {};

      store.commit("startNextStage", artists.length);
      async.eachLimit(
        artists,
        1, // LFM_CONCURRENT_API_REQUESTS
        function (artistName, callback) {
          store.commit("progressCurrentStage");
          // jQuery("#output").html(count + "/" + artists.length + " artist tags fetched.");

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
          jQuery.get(requestURL, function (data) {
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
          }).fail(function (err) {
            // Ignore failures
            callback();
          });
        },
        function (err) {
          var combinedData = combineArtistTags(artistData, tagData);
          resolve(combinedData);
        }
      );
    });
  }

  private getDataForTimeSpan(
    username: string,
    groupByCategory: string,
    groupByTime: string,
    timeSpan: TimeSpan,
    callback: any
  ) {
    var timeSegments = splitTimeSpan(groupByTime, timeSpan);
    var segmentData: SegmentData[][] = [];
    var LAST_FM_API_CONCURRENT_REQUESTS = 1;
    var LAST_FM_API_CADENCE_MS = 150;
    var self = this;

    store.commit("startNextStage", timeSegments.length);

    async.eachLimit(
      timeSegments,
      LAST_FM_API_CONCURRENT_REQUESTS,
      function (timeSegment, callback) {
        store.commit("progressCurrentStage");
        // TODO cache old segments (but not new ones!)
        var params = [
          new URLParameter("user", username),
          new URLParameter("from", timeSegment.start.toString()),
          new URLParameter("to", timeSegment.end.toString()),
        ];
        var requestURL = self.api.getAPIRequestURL(groupByCategory, params);

        // Make the request
        jQuery.get(requestURL, function (data) {
          if (!data.error) {
            // Parse through the data
            var parsedData = self.api.parseResponseJSON(data);
            segmentData.push(parsedData);
          }

          setTimeout(callback, LAST_FM_API_CADENCE_MS);
        }).fail(function (err) {
          // Ignore failures
          callback();
        });
      },
      function (err) {
        // All requests finished.
        var joinedSegments = joinSegments(segmentData);
        callback(err, joinedSegments);
      }
    );
  }

  private cacheData(options: any, data: any) {
    const key = JSON.stringify(options);
    this.dataCache[key] = data;
  }

  private getCachedData(options: any) {
    const key = JSON.stringify(options);
    if (this.dataCache[key]) {
      return this.dataCache[key];
    } else {
      return false;
    }
  }
}
