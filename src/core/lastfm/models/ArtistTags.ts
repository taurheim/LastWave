export interface ArtistTagsCache {
  get(key: string): string | null;
  set(key: string, value: string): void;
  has(key: string): boolean;
}

export default class ArtistTags {
  public artistName: string;
  public tags: string[];

  constructor(artistName: string) {
    this.artistName = artistName;
    this.tags = [];
  }

  public setTags(tags: string[]) {
    this.tags = tags;
  }

  public cache(storage?: ArtistTagsCache): void {
    if (!storage) return;
    storage.set(this.artistName, JSON.stringify(this.tags));
  }

  public loadFromCache(storage?: ArtistTagsCache): void {
    if (!storage) return;
    const cached = storage.get(this.artistName);
    if (cached) {
      this.setTags(JSON.parse(cached));
    }
  }

  public isInCache(storage?: ArtistTagsCache): boolean {
    if (!storage) return false;
    return storage.has(this.artistName);
  }
}
