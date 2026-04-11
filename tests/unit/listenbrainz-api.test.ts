import { describe, it, expect, vi, beforeEach } from 'vitest';
import ListenBrainzApi from '@/core/listenbrainz/ListenBrainzApi';
import artistsResponse from '../fixtures/listenbrainz-artists-response.json';
import releasesResponse from '../fixtures/listenbrainz-releases-response.json';

describe('ListenBrainzApi', () => {
  let api: ListenBrainzApi;

  beforeEach(() => {
    api = new ListenBrainzApi();
    vi.restoreAllMocks();
  });

  describe('fetchTopArtists (stats API)', () => {
    it('parses artist stats response correctly', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(artistsResponse), { status: 200 }),
      );

      const result = await api.fetchTopArtists('testuser', 1234567890, 1234667890);
      expect(result.length).toBe(3);
      expect(result[0].title).toBe('Radiohead');
      expect(result[0].count).toBe(45);
      expect(result[1].title).toBe('Pink Floyd');
      expect(result[1].count).toBe(32);
      expect(result[2].title).toBe('Coldplay');
      expect(result[2].count).toBe(28);
    });

    it('returns empty array for 204 (no content)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(null, { status: 204 }),
      );

      const result = await api.fetchTopArtists('testuser', 1234567890, 1234667890);
      expect(result).toEqual([]);
    });

    it('calls correct URL with from_ts and to_ts', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(artistsResponse), { status: 200 }),
      );

      await api.fetchTopArtists('testuser', 1000, 2000);

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('api.listenbrainz.org');
      expect(calledUrl).toContain('/stats/user/testuser/artists');
      expect(calledUrl).toContain('from_ts=1000');
      expect(calledUrl).toContain('to_ts=2000');
    });
  });

  describe('fetchTopAlbums (stats API)', () => {
    it('parses releases response with Album · Artist format', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(releasesResponse), { status: 200 }),
      );

      const result = await api.fetchTopAlbums('testuser', 1234567890, 1234667890);
      expect(result.length).toBe(3);
      expect(result[0].title).toBe('OK Computer · Radiohead');
      expect(result[0].count).toBe(25);
      expect(result[1].title).toBe('The Dark Side of the Moon · Pink Floyd');
      expect(result[1].count).toBe(18);
    });

    it('calls correct releases URL', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(releasesResponse), { status: 200 }),
      );

      await api.fetchTopAlbums('testuser', 1000, 2000);

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/stats/user/testuser/releases');
    });
  });

  describe('stats API fallback', () => {
    it('falls back to listens API on 400 error', async () => {
      // First call: stats API returns 400 (fetchWithRetry throws on 4xx)
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'Bad Request' }), { status: 400, statusText: 'Bad Request' }),
        )
        // Fallback: listens API returns data
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              payload: {
                listens: [
                  {
                    listened_at: 1500,
                    track_metadata: { artist_name: 'Radiohead', track_name: 'Creep' },
                  },
                  {
                    listened_at: 1600,
                    track_metadata: { artist_name: 'Radiohead', track_name: 'Karma Police' },
                  },
                  {
                    listened_at: 1700,
                    track_metadata: { artist_name: 'Coldplay', track_name: 'Yellow' },
                  },
                ],
              },
            }),
            { status: 200 },
          ),
        );

      const result = await api.fetchTopArtists('testuser', 1000, 2000);
      expect(result.length).toBe(2);

      const radiohead = result.find((r) => r.title === 'Radiohead');
      const coldplay = result.find((r) => r.title === 'Coldplay');
      expect(radiohead?.count).toBe(2);
      expect(coldplay?.count).toBe(1);
    });
  });
});
