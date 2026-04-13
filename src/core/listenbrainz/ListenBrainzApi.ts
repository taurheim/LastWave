import SegmentData from '@/core/models/SegmentData';
import { fetchWithRetry } from '@/core/fetchWithRetry';

const API_BASE_URL = 'https://api.listenbrainz.org/1';
const LISTENS_PAGE_SIZE = 100;

/**
 * Fetches listening data from ListenBrainz by paginating through the
 * raw listens endpoint and aggregating counts client-side.
 *
 * The ListenBrainz stats API (/stats/user/…) only offers pre-computed
 * aggregates for fixed ranges (week, month, year, all_time) — it cannot
 * return data for an arbitrary time window, which is what we need for
 * per-segment fetching.  So we always use the listens endpoint instead.
 */
export default class ListenBrainzApi {
  async fetchTopArtists(
    username: string,
    from: number,
    to: number,
  ): Promise<SegmentData[]> {
    return this.aggregateListens(username, from, to, (listen) => {
      return listen.track_metadata.artist_name;
    });
  }

  async fetchTopAlbums(
    username: string,
    from: number,
    to: number,
  ): Promise<SegmentData[]> {
    return this.aggregateListens(username, from, to, (listen) => {
      const release = listen.track_metadata.release_name;
      if (!release) return null;
      return `${release} · ${listen.track_metadata.artist_name}`;
    });
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
