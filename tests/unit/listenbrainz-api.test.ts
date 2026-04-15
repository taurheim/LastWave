import { describe, it, expect, vi, beforeEach } from 'vitest';
import ListenBrainzApi from '@/core/listenbrainz/ListenBrainzApi';

function mockListensResponse(listens: { listened_at: number; artist: string; track: string; release?: string }[]) {
  return new Response(
    JSON.stringify({
      payload: {
        listens: listens.map((l) => ({
          listened_at: l.listened_at,
          track_metadata: {
            artist_name: l.artist,
            track_name: l.track,
            ...(l.release ? { release_name: l.release } : {}),
          },
        })),
      },
    }),
    { status: 200 },
  );
}

describe('ListenBrainzApi', () => {
  let api: ListenBrainzApi;

  beforeEach(() => {
    api = new ListenBrainzApi();
    vi.restoreAllMocks();
  });

  describe('fetchTopArtists', () => {
    it('aggregates artist listen counts from the listens API', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockListensResponse([
          { listened_at: 1500, artist: 'Radiohead', track: 'Creep' },
          { listened_at: 1600, artist: 'Radiohead', track: 'Karma Police' },
          { listened_at: 1700, artist: 'Coldplay', track: 'Yellow' },
        ]),
      );

      const result = await api.fetchTopArtists('testuser', 1000, 2000);

      expect(result.length).toBe(2);
      expect(result[0].title).toBe('Radiohead');
      expect(result[0].count).toBe(2);
      expect(result[1].title).toBe('Coldplay');
      expect(result[1].count).toBe(1);
    });

    it('calls the listens endpoint with min_ts', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockListensResponse([]),
      );

      await api.fetchTopArtists('testuser', 1000, 2000);

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/user/testuser/listens');
      expect(calledUrl).toContain('min_ts=1000');
    });

    it('returns empty array when no listens exist', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockListensResponse([]),
      );

      const result = await api.fetchTopArtists('testuser', 1000, 2000);
      expect(result).toEqual([]);
    });

    it('passes max_ts to bound the request to the segment window', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockListensResponse([
          { listened_at: 1500, artist: 'Radiohead', track: 'Creep' },
        ]),
      );

      await api.fetchTopArtists('testuser', 1000, 2000);
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain('min_ts=1000');
      expect(url).toContain('max_ts=2000');
    });

    it('returns results sorted by count descending', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockListensResponse([
          { listened_at: 1100, artist: 'Coldplay', track: 'Yellow' },
          { listened_at: 1200, artist: 'Radiohead', track: 'Creep' },
          { listened_at: 1300, artist: 'Radiohead', track: 'Karma Police' },
          { listened_at: 1400, artist: 'Radiohead', track: 'OK Computer' },
          { listened_at: 1500, artist: 'Coldplay', track: 'Fix You' },
        ]),
      );

      const result = await api.fetchTopArtists('testuser', 1000, 2000);
      expect(result[0].title).toBe('Radiohead');
      expect(result[0].count).toBe(3);
      expect(result[1].title).toBe('Coldplay');
      expect(result[1].count).toBe(2);
    });
  });

  describe('fetchTopAlbums', () => {
    it('aggregates album listen counts in "Album · Artist" format', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockListensResponse([
          { listened_at: 1500, artist: 'Radiohead', track: 'Paranoid Android', release: 'OK Computer' },
          { listened_at: 1600, artist: 'Radiohead', track: 'Lucky', release: 'OK Computer' },
          { listened_at: 1700, artist: 'Pink Floyd', track: 'Money', release: 'The Dark Side of the Moon' },
        ]),
      );

      const result = await api.fetchTopAlbums('testuser', 1000, 2000);

      expect(result.length).toBe(2);
      expect(result[0].title).toBe('OK Computer · Radiohead');
      expect(result[0].count).toBe(2);
      expect(result[1].title).toBe('The Dark Side of the Moon · Pink Floyd');
      expect(result[1].count).toBe(1);
    });

    it('skips listens with no release name', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockListensResponse([
          { listened_at: 1500, artist: 'Radiohead', track: 'Creep' }, // no release
          { listened_at: 1600, artist: 'Pink Floyd', track: 'Money', release: 'DSOTM' },
        ]),
      );

      const result = await api.fetchTopAlbums('testuser', 1000, 2000);
      expect(result.length).toBe(1);
      expect(result[0].title).toBe('DSOTM · Pink Floyd');
    });
  });

  describe('sub-progress reporting', () => {
    it('calls onSubProgress with page numbers during pagination', async () => {
      // Generate 1001 listens to force 2 pages (page size is 1000)
      const page1Listens = Array.from({ length: 1000 }, (_, i) => ({
        listened_at: 1100 + i,
        artist: `Artist${i % 10}`,
        track: `Track${i}`,
      }));
      const page2Listens = [
        { listened_at: 2200, artist: 'FinalArtist', track: 'FinalTrack' },
      ];

      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(mockListensResponse(page1Listens))
        .mockResolvedValueOnce(mockListensResponse(page2Listens));

      const subProgress = vi.fn();
      await api.fetchTopArtists('testuser', 1000, 3000, subProgress);

      expect(subProgress).toHaveBeenCalledWith('page 2');
    });

    it('does not call onSubProgress when data fits in one page', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockListensResponse([
          { listened_at: 1500, artist: 'Radiohead', track: 'Creep' },
        ]),
      );

      const subProgress = vi.fn();
      await api.fetchTopArtists('testuser', 1000, 2000, subProgress);

      expect(subProgress).not.toHaveBeenCalled();
    });
  });
});
