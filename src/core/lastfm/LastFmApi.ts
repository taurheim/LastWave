import URLParameter from './models/URLParameter';
import SegmentData from '../models/SegmentData';

interface LastFmSegment {
  name: string;
  playcount?: string;
  count?: string;
  artist?: { '#text': string };
}

export interface LastFmResponse {
  [key: string]: {
    [key: string]: LastFmSegment[];
  };
}

export default class LastFmApi {
  private apiKey: string;
  private ALBUM_NAME_FORMAT: string = '{album} · {artist}';
  private API_BASE_URL: string = 'https://ws.audioscrobbler.com/2.0/';
  private METHODS: Record<string, string> = {
    artist: 'user.getweeklyartistchart',
    album: 'user.getweeklyalbumchart',
    tag: 'artist.gettoptags',
  };

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  public getAPIRequestURL(method: string, additionalParams: URLParameter[]) {
    let url = this.API_BASE_URL;
    url += '?method={method}';
    url += '&api_key=' + this.apiKey;
    url += '&format=json';

    url = url.replace('{method}', this.METHODS[method]);

    additionalParams.forEach((param) => {
      url += `&${param.paramName}=${param.paramValue}`;
    });
    return encodeURI(url);
  }

  public parseResponseJSON(responseJSON: LastFmResponse): SegmentData[] {
    const rootKey = Object.keys(responseJSON)[0];
    const secondKey = Object.keys(responseJSON[rootKey])[0];
    const responseData = responseJSON[rootKey][secondKey];
    const counts: SegmentData[] = [];

    if (responseData && typeof responseData === 'object') {
      responseData.forEach((segmentData: LastFmSegment) => {
        let name = segmentData.name;

        // If we're getting albums, get both the artist and album name
        if (secondKey === 'album') {
          const albumArtist = segmentData.artist?.['#text'] ?? '';
          const albumName = name;
          name = this.ALBUM_NAME_FORMAT;
          name = name.replace('{album}', albumName);
          name = name.replace('{artist}', albumArtist);
        }

        const count =
          secondKey === 'tag' ? (segmentData.count ?? '0') : (segmentData.playcount ?? '0');

        counts.push(new SegmentData(name, parseInt(count, 10)));
      });
    }

    return counts;
  }
}
