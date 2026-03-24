import { describe, it, expect } from 'vitest';
import LastFmApi from '@/core/lastfm/LastFmApi';
import URLParameter from '@/core/lastfm/models/URLParameter';
import artistResponse from '../fixtures/lastfm-artist-response.json';
import albumResponse from '../fixtures/lastfm-album-response.json';
import tagsResponse from '../fixtures/lastfm-tags-response.json';

describe('LastFmApi', () => {
  const api = new LastFmApi('test-api-key');

  describe('getAPIRequestURL', () => {
    it('constructs correct URL for artist method', () => {
      const params = [
        new URLParameter('user', 'testuser'),
        new URLParameter('from', '1234567890'),
        new URLParameter('to', '1234667890'),
      ];
      const url = api.getAPIRequestURL('artist', params);
      expect(url).toContain('ws.audioscrobbler.com');
      expect(url).toContain('user.getweeklyartistchart');
      expect(url).toContain('api_key=test-api-key');
      expect(url).toContain('user=testuser');
      expect(url).toContain('format=json');
    });

    it('constructs correct URL for album method', () => {
      const url = api.getAPIRequestURL('album', []);
      expect(url).toContain('user.getweeklyalbumchart');
    });

    it('constructs correct URL for tag method', () => {
      const params = [new URLParameter('artist', 'Radiohead')];
      const url = api.getAPIRequestURL('tag', params);
      expect(url).toContain('artist.gettoptags');
      expect(url).toContain('artist=Radiohead');
    });
  });

  describe('parseResponseJSON', () => {
    it('parses artist chart response correctly', () => {
      const result = api.parseResponseJSON(artistResponse);
      expect(result.length).toBe(8);
      expect(result[0].title).toBe('Radiohead');
      expect(result[0].count).toBe(45);
      expect(result[1].title).toBe('Pink Floyd');
      expect(result[1].count).toBe(32);
    });

    it('parses album chart response with artist<br>album format', () => {
      const result = api.parseResponseJSON(albumResponse);
      expect(result.length).toBe(5);
      expect(result[0].title).toContain('OK Computer');
      expect(result[0].title).toContain('Radiohead');
      expect(result[0].title).toContain('·');
      expect(result[0].count).toBe(25);
    });

    it('parses tag response correctly', () => {
      const result = api.parseResponseJSON(tagsResponse);
      expect(result.length).toBe(7);
      expect(result[0].title).toBe('alternative rock');
      expect(result[0].count).toBe(100);
    });

    it('handles empty response data', () => {
      const result = api.parseResponseJSON({ weeklyartistchart: { artist: [] } });
      expect(result).toEqual([]);
    });
  });
});
