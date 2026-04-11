import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LastFmDataSource } from '@/core/lastfm/LastFmDataSource';
import ListenBrainzDataSource from '@/core/listenbrainz/ListenBrainzDataSource';
import artistsResponse from '../fixtures/listenbrainz-artists-response.json';
import releasesResponse from '../fixtures/listenbrainz-releases-response.json';

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
    it('fetchSegment with artist method calls artists endpoint', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(artistsResponse), { status: 200 }),
      );

      const ds = new ListenBrainzDataSource();
      const result = await ds.fetchSegment('testuser', 'artist', 1000, 2000);

      expect(result.length).toBe(3);
      expect(result[0].title).toBe('Radiohead');
    });

    it('fetchSegment with album method calls releases endpoint', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(releasesResponse), { status: 200 }),
      );

      const ds = new ListenBrainzDataSource();
      const result = await ds.fetchSegment('testuser', 'album', 1000, 2000);

      expect(result.length).toBe(3);
      expect(result[0].title).toContain('·');

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/releases');
    });

    it('fetchSegment with tag method falls back to artists (genre lookup is separate)', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(artistsResponse), { status: 200 }),
      );

      const ds = new ListenBrainzDataSource();
      const result = await ds.fetchSegment('testuser', 'tag', 1000, 2000);

      expect(result.length).toBe(3);
      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/artists');
    });
  });
});
