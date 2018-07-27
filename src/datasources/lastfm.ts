import DataSource from 'src/models/DataSource';
import SeriesData from 'src/models/SeriesData';
import LoadingStage from '@/models/LoadingStage';
import LastFmApi from './lastfm/LastFmApi';
import URLParameter from './lastfm/models/URLParameter';
import Option from '@/models/Option';
import Bluebird from 'bluebird';
import Request from 'request-promise';

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
import store from '@/store';

export default class LastFm implements DataSource {
  public title: string;
  private api: LastFmApi;
  private dataCache: any = {};

  constructor() {
    this.title = 'last.fm';
    this.api = new LastFmApi('27ca6b1a0750cf3fb3e1f0ec5b432b72');
  }

  public async loadData(options: any): Promise<SeriesData[]> {
    const unixStart = DateStringToUnix(options.time_start);
    const unixEnd = DateStringToUnix(options.time_end);
    const username = options.username;
    const groupBy = options.group_by;
    const minPlays = options.min_plays;
    const method = options.method;
    const useLocalStorage = options.use_localstorage;
    const timeSpan = new TimeSpan(unixStart, unixEnd);
    const TAG_TOP_N_COUNT = 15;
    const self = this;

    const cachedData = this.getCachedData(options);
    if (cachedData) {
      // Need to progress the stages
      this.getLoadingStages(options).forEach(() => {
        store.commit('startNextStage', 1);
        store.commit('progressCurrentStage');
      });
      return cachedData;
    }

    // TODO error checking (date in future, etc.)

    const firstMethod = (method === 'tag') ? 'artist' : method;

    const data = await this.getDataForTimeSpan(username, firstMethod, groupBy, timeSpan);
    let cleanedData;
    switch (method) {
      case 'artist':
      case 'album':
        cleanedData = cleanByMinPlays(data, minPlays);

        if (cleanedData.length === 0) {
          throw new Error([
            `Not enough data: found ${data.length} artists/albums`,
            `but none that were over the minimum of ${minPlays} plays.`,
            'Please go into advanced settings and lower your minimum plays option.',
          ].join(' '));
        }

        this.cacheData(options, cleanedData);
        break;
      case 'tag':
        // Now that we have the artist data, we need to get the tags.
        const tagData = await self.getTagsForArtistData(data, useLocalStorage);
        cleanedData = cleanByTopN(tagData, TAG_TOP_N_COUNT);
        this.cacheData(options, cleanedData);
        break;
      default:
        throw new Error(`Method not recognized: ${method}`);
    }

    return cleanedData;
  }

  public getOptions(): Option[] {
    const today = new Date();
    const defaultStartDate = new Date();
    defaultStartDate.setDate(today.getDate() - 1);
    defaultStartDate.setMonth(today.getMonth() - 1);
    // defaultStartDate.setFullYear(today.getFullYear() - 1);

    // TODO there's definitely a better way to handle these options
    return LastFmOptions;
  }

  public getLoadingStages(options: any): LoadingStage[] {
    switch (options.method) {
      case 'tag':
        return [
          new LoadingStage(
            'Fetching artist data...',
            50,
          ),
          new LoadingStage(
            'Fetching tag data (this will be slow the first time)',
            50,
          ),
        ];
        break;
      case 'artist':
      case 'album':
        return [
          new LoadingStage(
            'Getting data...',
            100,
          ),
        ];
        break;
      default:
        return [];
    }
  }

  private async getTagsForArtistData(artistData: SeriesData[], useLocalStorage: boolean): Promise<SeriesData[]> {
    // TODO Promisify
    // TODO use config file
    const LAST_FM_API_CADENCE_MS = 150;
    // Make an array of artists
    const artists = artistData.map((artistObject) => {
      return artistObject.title;
    });

    store.commit('startNextStage', artists.length);
    const tagData = await Bluebird.map(artists, async (artistName) => {
      store.commit('progressCurrentStage');
      // jQuery("#output").html(count + "/" + artists.length + " artist tags fetched.");

      const artistTags = new ArtistTags(artistName);

      // Check the cache if necessary
      if (useLocalStorage && artistTags.isInCache()) {
        artistTags.loadFromCache();
        return artistTags;
      }

      // Make the request
      const requestParams = [
        new URLParameter('artist', artistName),
      ];
      const requestURL = this.api.getAPIRequestURL('tag', requestParams);
      const data = await Request(requestURL, {
        json: true,
      });

      if (!data.error) {
        const allTags = this.api.parseResponseJSON(data);
        const topTags = getTopTags(allTags);

        artistTags.setTags(topTags);

        if (useLocalStorage) {
          artistTags.cache();
        }
      }

      // https://esdiscuss.org/topic/await-settimeout-in-async-functions
      await new Promise((r) => setTimeout(r, LAST_FM_API_CADENCE_MS));

      return artistTags;
    }, {
        concurrency: 1,
      });

    // TODO this is kind of ugly
    const tagMap: { [key: string]: ArtistTags } = {};
    tagData.forEach((data) => {
      tagMap[data.artistName] = data;
    });

    const combinedData = combineArtistTags(artistData, tagMap);
    return combinedData;
  }

  private async getDataForTimeSpan(
    username: string,
    groupByCategory: string,
    groupByTime: string,
    timeSpan: TimeSpan,
  ) {
    const timeSegments = splitTimeSpan(groupByTime, timeSpan);
    const LAST_FM_API_CONCURRENT_REQUESTS = 1;
    const LAST_FM_API_CADENCE_MS = 150;

    store.commit('startNextStage', timeSegments.length);

    const segmentData = await Bluebird.map(timeSegments, async (timeSegment) => {
      store.commit('progressCurrentStage');
      // TODO cache old segments (but not new ones!)
      const params = [
        new URLParameter('user', username),
        new URLParameter('from', timeSegment.start.toString()),
        new URLParameter('to', timeSegment.end.toString()),
      ];
      const requestURL = this.api.getAPIRequestURL(groupByCategory, params);

      // Make the request
      const data = await Request(requestURL, {
        json: true,
      });

      if (data.error) {
        throw new Error(data.error);
      }
      const parsedData = this.api.parseResponseJSON(data);

      // https://esdiscuss.org/topic/await-settimeout-in-async-functions
      await new Promise((r) => setTimeout(r, LAST_FM_API_CADENCE_MS));

      return parsedData;
    }, {
        concurrency: LAST_FM_API_CONCURRENT_REQUESTS,
      });

    const joinedSegments = joinSegments(segmentData);
    return joinedSegments;
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
