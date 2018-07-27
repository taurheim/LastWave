export default class ArtistTags  {
  public artistName: string;
  public tags: string[];

  constructor(artistName: string) {
    this.artistName = artistName;
    this.tags = [];
  }

  public setTags(tags: string[]) {
    this.tags = tags;
  }

  public cache(): void {
    window.localStorage[this.artistName] = JSON.stringify(this.tags);
  }

  public loadFromCache(): void {
    this.setTags(JSON.parse(window.localStorage[this.artistName]));
  }

  public isInCache(): boolean {
    return window.localStorage[this.artistName] != null;
  }
}
