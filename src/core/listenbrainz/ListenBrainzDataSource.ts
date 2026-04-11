import type { DataSource } from '@/core/dataSource';
import type SegmentData from '@/core/models/SegmentData';
import ListenBrainzApi from '@/core/listenbrainz/ListenBrainzApi';

export default class ListenBrainzDataSource implements DataSource {
  private api = new ListenBrainzApi();

  async fetchSegment(
    username: string,
    method: string,
    from: number,
    to: number,
  ): Promise<SegmentData[]> {
    if (method === 'album') {
      return this.api.fetchTopAlbums(username, from, to);
    }
    return this.api.fetchTopArtists(username, from, to);
  }
}
