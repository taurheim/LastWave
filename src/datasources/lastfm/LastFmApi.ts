import URLParameter from './models/URLParameter';
import SegmentData from '@/models/SegmentData';

export default class LastFmApi {
  apiKey: string;
  ALBUM_NAME_FORMAT: string = "{album}<br>{artist}";
  API_BASE_URL: string = "https://ws.audioscrobbler.com/2.0/";
  METHODS: any = {
    artist: "user.getweeklyartistchart",
    album: "user.getweeklyalbumchart",
    tag: "artist.gettoptags",
  };

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  getAPIRequestURL(method: string, additionalParams: URLParameter[]) {
    var url = this.API_BASE_URL;
    url += "?method={method}";
    url += "&api_key=" + this.apiKey;
    url += "&format=json";

    url = url.replace("{method}", this.METHODS[method]);

    additionalParams.forEach((param) => {
      // TODO encode additionalParams
      url += "&" + param.paramName + "=" + param.paramValue;
    });
    return encodeURI(url);
  }

  parseResponseJSON(responseJSON: any): SegmentData[] {
    var rootKey = Object.keys(responseJSON)[0];
    var secondKey = Object.keys(responseJSON[rootKey])[0];
    var responseData = responseJSON[rootKey][secondKey];
    var counts = [];

    for (var i = 0; i < responseData.length; i++) {
      var segmentData = responseData[i];
      var name = segmentData.name;

      // If we're getting albums, get both the artist and album name
      if (secondKey === "album") {
        var albumArtist = segmentData.artist["#text"];
        var albumName = name;
        name = this.ALBUM_NAME_FORMAT;
        name = name.replace("{album}", albumName);
        name = name.replace("{artist}", albumArtist);
      }

      var count;
      if (secondKey === "tag") {
        count = segmentData.count; 
      } else {
        count = segmentData.playcount;
      }

      counts.push(new SegmentData(name, parseInt(count)));
    }

    return counts;
  }
}
