/*
  @param artist Name Name of the artist
  @param tags Array of tags associated with the artist
*/
function ArtistTags(artistName) {
  this.artistName = artistName;
  this.tags = [];

  this.setTags = function(tags) {
    this.tags = tags;
  }

  this.cache = function() {
    window.localStorage[this.artistName] = JSON.stringify(this.tags);
  }

  this.loadFromCache = function() {
    this.setTags(JSON.parse(window.localStorage[this.artistName]));
  }

  this.isInCache = function() {
    return window.localStorage[this.artistName] != null;
  }
}
