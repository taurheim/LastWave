import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LastFmDataSource } from '@/core/lastfm/LastFmDataSource';
import ListenBrainzDataSource from '@/core/listenbrainz/ListenBrainzDataSource';

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

describe('DataSource implementations', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('LastFmDataSource', () => {
    it('implements fetchSegment and calls Last.fm API', async () => {
      const artistResponse = {
        weeklyartistchart: {
          artist: [
            { name: 'Radiohead', playcount: '45' },
            { name: 'Pink Floyd', playcount: '32' },
          ],
        },
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(artistResponse), { status: 200 }),
      );

      const ds = new LastFmDataSource('test-key');
      const result = await ds.fetchSegment('testuser', 'artist', 1000, 2000);

      expect(result.length).toBe(2);
      expect(result[0].title).toBe('Radiohead');
      expect(result[0].count).toBe(45);
    });

    it('maps tag method to artist for fetching', async () => {
      const artistResponse = {
        weeklyartistchart: {
          artist: [{ name: 'Radiohead', playcount: '10' }],
        },
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(artistResponse), { status: 200 }),
      );

      const ds = new LastFmDataSource('test-key');
      await ds.fetchSegment('testuser', 'tag', 1000, 2000);

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('user.getweeklyartistchart');
    });
  });

  describe('ListenBrainzDataSource', () => {
    it('fetchSegment with artist method aggregates from listens API', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockListensResponse([
          { listened_at: 1500, artist: 'Radiohead', track: 'Creep' },
          { listened_at: 1600, artist: 'Radiohead', track: 'Karma Police' },
          { listened_at: 1700, artist: 'Coldplay', track: 'Yellow' },
        ]),
      );

      const ds = new ListenBrainzDataSource();
      const result = await ds.fetchSegment('testuser', 'artist', 1000, 2000);

      expect(result.length).toBe(2);
      expect(result[0].title).toBe('Radiohead');
      expect(result[0].count).toBe(2);
    });

    it('fetchSegment with album method uses release names', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockListensResponse([
          { listened_at: 1500, artist: 'Radiohead', track: 'Paranoid Android', release: 'OK Computer' },
          { listened_at: 1600, artist: 'Pink Floyd', track: 'Money', release: 'DSOTM' },
        ]),
      );

      const ds = new ListenBrainzDataSource();
      const result = await ds.fetchSegment('testuser', 'album', 1000, 2000);

      expect(result.length).toBe(2);
      expect(result[0].title).toContain('·');

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/user/testuser/listens');
    });

    it('fetchSegment with tag method fetches artists (genre lookup is separate)', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockListensResponse([
          { listened_at: 1500, artist: 'Radiohead', track: 'Creep' },
        ]),
      );

      const ds = new ListenBrainzDataSource();
      const result = await ds.fetchSegment('testuser', 'tag', 1000, 2000);

      expect(result.length).toBe(1);
      expect(result[0].title).toBe('Radiohead');
      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/user/testuser/listens');
    });
  });
});
