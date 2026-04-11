import SegmentData from '@/core/models/SegmentData';
import { fetchWithRetry } from '@/core/fetchWithRetry';

const API_BASE_URL = 'https://api.listenbrainz.org/1';
const LISTENS_PAGE_SIZE = 100;

type StatsSupport = 'unknown' | 'supported' | 'unsupported';

export default class ListenBrainzApi {
  private statsSupport: StatsSupport = 'unknown';

  async fetchTopArtists(
    username: string,
    from: number,
    to: number,
  ): Promise<SegmentData[]> {
    if (this.statsSupport !== 'unsupported') {
      const result = await this.fetchStats(username, 'artists', from, to);
      if (result !== null) return result;
    }
    return this.aggregateListens(username, from, to, (listen) => {
      return listen.track_metadata.artist_name;
    });
  }

  async fetchTopAlbums(
    username: string,
    from: number,
    to: number,
  ): Promise<SegmentData[]> {
    if (this.statsSupport !== 'unsupported') {
      const result = await this.fetchStats(username, 'releases', from, to);
      if (result !== null) return result;
    }
    return this.aggregateListens(username, from, to, (listen) => {
      const release = listen.track_metadata.release_name;
      if (!release) return null;
      return `${release} · ${listen.track_metadata.artist_name}`;
    });
  }

  private async fetchStats(
    username: string,
    entity: 'artists' | 'releases',
    from: number,
    to: number,
  ): Promise<SegmentData[] | null> {
    const url =
      `${API_BASE_URL}/stats/user/${encodeURIComponent(username)}/${entity}` +
      `?from_ts=${from}&to_ts=${to}&count=${LISTENS_PAGE_SIZE}`;

    let response: Response;
    try {
      response = await fetchWithRetry(url);
    } catch {
      this.statsSupport = 'unsupported';
      return null;
    }

    if (response.status === 204) {
      this.statsSupport = 'supported';
      return [];
    }

    if (response.status === 400) {
      this.statsSupport = 'unsupported';
      return null;
    }

    if (!response.ok) {
      throw new Error(`ListenBrainz stats API error: ${response.status}`);
    }

    this.statsSupport = 'supported';
    const json = await response.json();

    if (entity === 'artists') {
      const artists = json?.payload?.artists ?? [];
      return artists.map(
        (a: { artist_name: string; listen_count: number }) =>
          new SegmentData(a.artist_name, a.listen_count),
      );
    }

    const releases = json?.payload?.releases ?? [];
    return releases.map(
      (r: { release_name: string; artist_name: string; listen_count: number }) =>
        new SegmentData(`${r.release_name} · ${r.artist_name}`, r.listen_count),
    );
  }

  private async aggregateListens(
    username: string,
    from: number,
    to: number,
    keyFn: (listen: Listen) => string | null,
  ): Promise<SegmentData[]> {
    const counts = new Map<string, number>();
    let minTs = from;

    while (true) {
      const url =
        `${API_BASE_URL}/user/${encodeURIComponent(username)}/listens` +
        `?min_ts=${minTs}&count=${LISTENS_PAGE_SIZE}`;

      const response = await fetchWithRetry(url);
      if (!response.ok) {
        throw new Error(`ListenBrainz listens API error: ${response.status}`);
      }

      const json = await response.json();
      const listens: Listen[] = json?.payload?.listens ?? [];

      if (listens.length === 0) break;

      let maxTs = minTs;
      for (const listen of listens) {
        if (listen.listened_at > to) continue;
        const key = keyFn(listen);
        if (key) {
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        if (listen.listened_at > maxTs) {
          maxTs = listen.listened_at;
        }
      }

      if (maxTs >= to || listens.length < LISTENS_PAGE_SIZE) break;
      minTs = maxTs;
    }

    return Array.from(counts.entries())
      .map(([title, count]) => new SegmentData(title, count))
      .sort((a, b) => b.count - a.count);
  }
}

interface Listen {
  listened_at: number;
  track_metadata: {
    artist_name: string;
    release_name?: string;
    track_name: string;
  };
}
