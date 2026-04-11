import type { DataSource } from '@/core/dataSource';
import type { LastFmResponse } from '@/core/lastfm/LastFmApi';
import LastFmApi from '@/core/lastfm/LastFmApi';
import URLParameter from '@/core/lastfm/models/URLParameter';
import { fetchWithRetry } from '@/core/fetchWithRetry';
import type SegmentData from '@/core/models/SegmentData';

export class LastFmDataSource implements DataSource {
  private api: LastFmApi;

  constructor(apiKey: string) {
    this.api = new LastFmApi(apiKey);
  }

  async fetchSegment(
    username: string,
    method: string,
    from: number,
    to: number,
  ): Promise<SegmentData[]> {
    const apiMethod = method === 'tag' ? 'artist' : method;

    const params = [
      new URLParameter('user', username),
      new URLParameter('from', String(from)),
      new URLParameter('to', String(to)),
    ];

    const url = this.api.getAPIRequestURL(apiMethod, params);
    const response = await fetchWithRetry(url);
    const json: LastFmResponse = await response.json();

    return this.api.parseResponseJSON(json);
  }
}
