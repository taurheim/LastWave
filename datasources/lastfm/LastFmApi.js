  /*
    Returns an array of:
    {
      name: <Name of artist/genre/etc.>
      count: <int>
    }
  */
  this.parseResponseJSON = function(responseJSON) {
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
        name = self.ALBUM_NAME_FORMAT;
        name = name.replace("{album}", albumName);
        name = name.replace("{artist}", albumArtist);
      }

      var count;
      if (secondKey === "tag") {
        count = segmentData.count; 
      } else {
        count = segmentData.playcount;
      }

      counts.push({
        name: name,
        count: parseInt(count),
      });
    }

    return counts;
  }
