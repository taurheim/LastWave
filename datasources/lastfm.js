/**
 * Implements DataSource
 */
function LastFm() {
  var self = this;
  this.title = "last.fm";
  // Send an api every __ ms
  this.LAST_FM_API_CADENCE_MS = 100;
  // TODO If this is set to more than 1 there is a race condition
  this.LAST_FM_API_CONCURRENT_REQUESTS = 1; 
  this.INTERVALS = {
    week: 604800,
    month: 2628000,
  };
  this.METHODS = {
    artist: "user.getweeklyartistchart",
    album: "user.getweeklyalbumchart",
    tag: "artist.gettoptags",
  };
  this.API_KEY = "27ca6b1a0750cf3fb3e1f0ec5b432b72";
  this.API_URL = "http://ws.audioscrobbler.com/2.0/";
    this.API_URL += "?method={method}";
    this.API_URL += "&api_key=" + this.API_KEY;
    this.API_URL += "&format=json";
  this.API_RESPONSE_ROOT_DIV_TAG = "lfm";
  this.LFM_IGNORE_NODE_NAME = "#text";
  this.LFM_NAME_TAG = "name";
  this.LFM_PLAYS_TAG = "playcount";
  this.LFM_ARTIST_TAG = "artist";
  this.LFM_TAG_COUNT_TAG = "count";
  this.ALBUM_NAME_FORMAT = '{album}<br>{artist}';
  this.IGNORE_TAG_WEIGHT_UNDER = 50;
  this.TAG_TOP_N_COUNT = 10;
  this.DEFAULT_MIN_PLAYS = 10;
  this.IGNORE_TAGS = [
    "seen live",
  ];

  this.getOptions = function() {
    var today = new Date();
    var defaultStartDate = new Date();
    defaultStartDate.setDate(today.getDate() - 1);
    defaultStartDate.setMonth(today.getMonth() - 1);
    // defaultStartDate.setFullYear(today.getFullYear() - 1);
    return {
      "username": {
        "title": "last.fm username",
        "type": "string",
        "default": "Taurheim"
      },
      "time_start": {
        "title": "Timespan start",
        "type": "date",
        "default": (defaultStartDate).toLocaleDateString("en-US"),
      },
      "time_end": {
        "title": "Timespan end",
        "type": "date",
        "default": today.toLocaleDateString("en-US"),
      },
      "group_by": {
        "title": "Group By",
        "type": "dropdown",
        "options": [
          "week",
          "month",
        ]
      },
      "min_plays": {
        "title": "Minimum plays",
        "type": "int",
        "default": this.DEFAULT_MIN_PLAYS,
      },
      "method": {
        "title": "Data Set",
        "type": "dropdown",
        "options": [
          "tag",
          "artist",
          "album",
        ],
      },
      "use_localstorage": {
        "title": "Cache last.fm responses",
        "type": "toggle",
        "default": true,
      },
    }
  }
  
  /*
    Split a time span into weeks/months.
    @param splitBy "month" or "week"
    @param unixStart Unix timestamp for the start of the time span
    @param unixEnd Unix timestmap for the end of the time span
    @return Array of TimeSpan objects, each one corresponding to a week/month
  */
  this.splitTimeSpan = function(splitBy, timeSpan) {
    var segments = [];
    var interval = this.INTERVALS[splitBy];
    for (var t = timeSpan.start; t < timeSpan.end; t += interval) {
      segments.push(new TimeSpan(t, t + interval));
    }

    console.log("Time span: " + timeSpan.start + " to " + timeSpan.end);
    console.log("Split into " + segments.length + " segments");

    return segments;
  }

  /*
    Make a call to the last.fm api.
    @param method
    @param additionalParams
    @return url
  */
  this.getAPIRequestURL = function(method, additionalParams) {
    var url = this.API_URL;
    url = url.replace("{method}", this.METHODS[method]);
    for (var k in additionalParams) {
      url += "&" + k + "=" + additionalParams[k];
    }
    return encodeURI(url);
  }

  /*
    Remove any artist/genre/etc. that has fewer than minPlays plays in its
    largest time segment.
    Assume data in format:
    [
      {
        name: <string>
        counts: [<int>]
      }
    ]
  */
  this.cleanByMinPlays = function(data, minPlays) {
    console.log("Before clean: " + data.length);
    var cleanedData = data.filter(function(obj) {
      var maxPlays = 0;
      for (var i = 0; i < obj.counts.length; i++) {
        var playCount = obj.counts[i];
        if(playCount > maxPlays) maxPlays = playCount;
      }

      return maxPlays >= minPlays;
    });
    console.log("After clean: " + cleanedData.length);

    return cleanedData;
  }

  /*
    Only keep the top N groups
  */
  this.cleanByTopN = function(data, n) {
    data.sort(function(a, b) {
      var maxA = 0;
      var maxB = 0;
      for (var i = 0; i < a.counts.length; i++) {
        if (a.counts[i] > maxA) maxA = a.counts[i];
        if (b.counts[i] > maxB) maxB = b.counts[i];
      }

      return maxB - maxA;
    });

    return data.slice(0, n);
  }

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

  /*
    @param allTags
      [
        {
          name: <tag name>,
          count: <tag weight>,
        }
      ]
    @return [<tag name>]
  */
  this.getTopTags = function(allTags) {
    var topTags = [];
    for (var i = 0; i < allTags.length; i++) {
      var tag = allTags[i];

      // Make sure it's not on the blacklist
      if (
        this.IGNORE_TAGS.indexOf(tag.name) === -1 &&
        tag.count > this.IGNORE_TAG_WEIGHT_UNDER
      ) {
        topTags.push(tag.name);
      }
    }
    return topTags;
  }

  // TODO DRY for the other async limit
  /*
    artistData should look like this:
    [
      {
        "title": <string>,
        "counts": [<int>]
      }
    ]
  */
  this.getTagsForArtistData = function(artistData, useLocalStorage, callback) {
    var count = 0;
    // Make an array of artists
    var artists = artistData.map(function(artistObject) {
      return artistObject.title;
    });
    var tagData = {};

    async.eachLimit(
      artists,
      this.LAST_FM_API_CONCURRENT_REQUESTS,
      function(artistName, callback) {
        count++;
        $("#output").html(count + "/" + artists.length + " artist tags fetched.");

        var artistTags = new ArtistTags(artistName);

        // Check the cache if necessary
        if (useLocalStorage && artistTags.isInCache()) {
          artistTags.fetchFromCache();
          tagData[artistName] = artistTags;
          return callback();
        }

        // Make the request
        var requestParams = {
          artist: artistName,
        };
        var requestURL = self.getAPIRequestURL("tag", requestParams);
        $.get(requestURL, function(data) {
          if (!data.error) {
            var allTags = self.parseResponseJSON(data);
            var topTags = self.getTopTags(allTags);

            artistTags.setTags(topTags);
            tagData[artistName] = artistTags;

            if (useLocalStorage) {
              artistTags.cache();
            }
          }

          setTimeout(callback, self.LAST_FM_API_CADENCE_MS);
        }).fail(function(err) {
          // Ignore failures
          callback();
        });
      },
      function(err) {
        var combinedData = self.combineArtistTags(artistData, tagData);
        callback(err, combinedData);
      }
    );
  }

  /*
    Take in a list of artist playcounts:
    [
      {
        "title": <string> (Name of artist)
        "counts": [<int>] (counts of artist over time)
      }
    ]

    and a map of tags for artists:
      key: <artist name>
      value: <ArtistTags object>

    and combine them into a new list of tags:
    [
      {
        "title": <string>,  (Name of tag)
        "counts": [<int>]   (Count of tag)
      }
    ]

    TODO this can likely be combined in a smart way with joinSegments
  */
  this.combineArtistTags = function(artistData, tagData) {
    // Key: tag name
    // Value: {name: <string>, counts: [<int>]}
    var countsByTag = {};

    for(var i = 0; i < artistData.length; i++) {
      var artistName = artistData[i].title;
      var segmentCounts = artistData[i].counts;
      var artistTags = tagData[artistName];

      // Sometimes we couldn't get tags
      if (!artistTags) {
        continue;
      }
      
      // Go through every time segment
      for(var s = 0; s < segmentCounts.length; s++) {
        var segmentCount = segmentCounts[s];

        // Go through every tag
        for (var t = 0; t < artistTags.tags.length; t++) {
          var tagName = artistTags.tags[t];

          if (!countsByTag[tagName]) {
            countsByTag[tagName] = {
              title: tagName,
              counts: new Array(segmentCounts.length+1).join('0').split('').map(parseFloat),
            }
          }

          countsByTag[tagName].counts[s] += segmentCount;
        }
      }
    }

    // Turn our map into an array
    return Array.from(Object.values(countsByTag));
  }

  /*
    Each segment should be an array of objects:
    {
      name: <Name of artist/genre>
      count: <int>
    }

    which we will turn into an array of objects:
    {
      title: <Name of artist/genre>
      counts: [<int>]
    }

    // TODO I can probably do this with some fancy map/reduce
  */
  this.joinSegments = function(segmentData) {
    // Use a map to join the data
    var countsByName = {};

    for (var s = 0; s < segmentData.length; s++) {
      for (var n = 0; n < segmentData[s].length; n++) {
        var nameData = segmentData[s][n];
        var name = nameData.name;
        var count = parseInt(nameData.count);

        if (!countsByName[name]) {
          // Hasn't been added to the map yet
          // Fill count with 0s
          countsByName[name] = {
            title: name,
            counts: new Array(segmentData.length+1).join('0').split('').map(parseFloat),
          }
        }

        countsByName[name].counts[s] = count;
      }
    }

    console.log("Joined " + segmentData.length + " segments");

    // Turn our map into an array
    return Array.from(Object.values(countsByName));
  }

  /*
    Get data from the last.fm API for a given time span.
  */
  this.getDataForTimeSpan = function(username, groupByCategory, groupByTime, timeSpan, callback) {
    var timeSegments = this.splitTimeSpan(groupByTime, timeSpan);
    var count = 0;
    var segmentData = [];

    async.eachLimit(
      timeSegments,
      this.LAST_FM_API_CONCURRENT_REQUESTS,
      function (timeSegment, callback) {
        count++;
        $("#output").html(count + "/" + timeSegments.length + " time segments");
        // TODO cache old segments (but not new ones!)
        var params = {
          user: username,
          from: timeSegment.start,
          to: timeSegment.end,
        };
        var requestURL = self.getAPIRequestURL(groupByCategory, params);

        // Make the request
        $.get(requestURL, function(data) {
          if (!data.error) {
            // Parse through the data
            var parsedData = self.parseResponseJSON(data);
            segmentData.push(parsedData);
          }

          setTimeout(callback, this.LAST_FM_API_CADENCE_MS);
        }).fail(function(err) {
          // Ignore failures
          callback();
        });
      },
      function(err) {
        // All requests finished.
        var joinedSegments = self.joinSegments(segmentData);
        callback(err, joinedSegments);
      }
    );
  }

  /*
    Main entry point for the data source.
  */
  this.loadData = function(options, callback) {
    var unixStart = DateStringToUnix(options["time_start"]);
    var unixEnd = DateStringToUnix(options["time_end"]);
    var username = options["username"];
    var groupBy = options["group_by"];
    var minPlays = options["min_plays"];
    var method = options["method"];
    var useLocalStorage = options["use_localstorage"];
    var timeSpan = new TimeSpan(unixStart, unixEnd);

    // TODO error checking (date in future, etc.)
    // TODO instead of using localstorage as a request cache, make it smaller
    // by only caching the responses we care about (e.g. if we had a request for
    // RHCP plays, we would cache just the number of plays)
    var firstMethod = (method === "tag") ? "artist" : method;
    this.getDataForTimeSpan(username, firstMethod, groupBy, timeSpan, function(err, data) {
      switch(method) {
        case "artist":
        case "album":
          var cleanedData = self.cleanByMinPlays(data, minPlays);
          callback(err, cleanedData);
          break;
        case "tag":
          // Now that we have the artist data, we need to get the tags.
          self.getTagsForArtistData(data, useLocalStorage, function(err, tagData) {
            var cleanedData = self.cleanByTopN(tagData, self.TAG_TOP_N_COUNT);
            callback(err, cleanedData);
          });
          break;
        default:
          callback("Method not recognized: " + method);
      }
    });
  }
}

/**
 * Util
 */

/**
 * Convert from date in format YY/MM/DD to unix timestamp
 */
function DateStringToUnix(dateString) {
  return (new Date(dateString)).getTime() / 1000;
}

/**
 * Round the unix timestamp to the nearest week. Last.fm doesn't seem to like 
 * giving data back for weeks that aren't rounded to the week so this is the hack to fix that.
 * @param {int} unixTimestamp 
 */
function RoundWeek(unixTimestamp) {
  // TODO Explain better
  var ONE_WEEK_IN_SECONDS = 604800;
  return Math.round(unixTimestamp / ONE_WEEK_IN_SECONDS) * ONE_WEEK_IN_SECONDS;
}

/*
 */
function TimeSpan(start, end) {
  this.start = start;
  this.end = end;
}

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

  this.fetchFromCache = function() {
    this.setTags(JSON.parse(window.localStorage[this.artistName]));
  }

  this.isInCache = function() {
    return window.localStorage[this.artistName] != null;
  }
}
