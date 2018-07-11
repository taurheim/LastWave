export default class ArtistTags  {
  artistName: string;
  tags: string[];

  constructor(artistName: string) {
    this.artistName = artistName;
    this.tags = [];
  }

  setTags(tags: string[]) {
    this.tags = tags;
  }

  cache(): void {
    window.localStorage[this.artistName] = JSON.stringify(this.tags);
  }

  loadFromCache(): void {
    this.setTags(JSON.parse(window.localStorage[this.artistName]));
  }

  isInCache(): boolean {
    return window.localStorage[this.artistName] != null;
  }
}
