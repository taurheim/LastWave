/**
 * Implements DataSource
 */
function LastFm() {
  var self = this;
  this.title = "last.fm";
  // Send an api every __ ms
  this.LAST_FM_API_CADENCE_MS = 500;
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
  this.IGNORE_TAGS = [
    "seen live",
  ];

  this.getOptions = function() {
    var today = new Date();
    var defaultStartDate = new Date();
    defaultStartDate.setDate(today.getDate() - 1);
    defaultStartDate.setMonth(today.getMonth() - 3);
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
        "default": 30,
      },
      "method": {
        "title": "Data Set",
        "type": "dropdown",
        "options": [
          "tag",
          "album",
          "artist",
        ],
      },
      "use_localstorage": {
        "title": "Cache last.fm responses",
        "type": "toggle",
        "default": true,
      },
    }
  }
  
  this.splitTimeSpan = function(splitBy, unixStart, unixEnd) {
    console.log("Time span: " + unixStart + " to " + unixEnd);
    var segments = [];
    var interval = this.INTERVALS[splitBy];
    for (var t = unixStart; t < unixEnd; t += interval) {
      segments.push(new TimeSpan(t, t + interval));
    }

    return segments;
  }

  /*
    Additional params should be an object of keys and values
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
  this.parseResponseDoc = function(xmlDoc) {
    var rootDiv = xmlDoc.getElementsByTagName(this.API_RESPONSE_ROOT_DIV_TAG)[0];
    var segments = rootDiv.childNodes[0].childNodes;
    var counts = [];


    console.log("Parsing doc with " + segments.length + " artists");

    for (var i = 0; i < segments.length; i++) {
      var segmentData = segments[i];
      if (segmentData.nodeName === self.LFM_IGNORE_NODE_NAME) continue;
      var name = segmentData.getElementsByTagName(self.LFM_NAME_TAG)[0].childNodes[0].nodeValue;
      
      // Combine album + name
      if (segmentData.getElementsByTagName(self.LFM_ARTIST_TAG).length) {
        var albumArtist = segmentData.getElementsByTagName(self.LFM_ARTIST_TAG)[0].childNodes[0].nodeValue;
        var albumName = name;
        name = self.ALBUM_NAME_FORMAT;
        name = name.replace("{album}", albumName);
        name = name.replace("{artist}", albumArtist);
      }

      var count;
      if (segmentData.getElementsByTagName(self.LFM_PLAYS_TAG).length) {
        count = segmentData.getElementsByTagName(self.LFM_PLAYS_TAG)[0].childNodes[0].nodeValue;
      } else if (segmentData.getElementsByTagName(self.LFM_TAG_COUNT_TAG).length) {
        count = segmentData.getElementsByTagName(self.LFM_TAG_COUNT_TAG)[0].childNodes[0].nodeValue;
      }

      counts.push({
        name: name,
        count: parseInt(count),
      });
    }

    return counts;
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
    // 1. Get all tags for every artist
    var requests = [];
    for (var i = 0; i < artistData.length; i++) {
      var artist = artistData[i];
      var requestMethod = "tag";
      var requestParams = {
        // TODO normalize name vs title
        artist: artist.title,
      };

      requests.push(this.getAPIRequestURL(requestMethod, requestParams));
    }

    this.sendAllRequests(requests, useLocalStorage, function(err, lastFmData) {
      var tagData = {};
      for (var i = 0; i < lastFmData.length; i++) {
        var name = artistData[i].title;
        var tags = self.parseResponseJSON(lastFmData[i]);
        tagData[name] = tags;
      }

      // 2. Multiply the play counts for every time span by the tags
      callback(null, self.combineArtistTags(artistData, tagData));
    });
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
      value: [
        {
          "name": <string>, (Name of tag)
          "count": <int> (Weight of tag)
        }
      ]

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
        for (var t = 0; t < artistTags.length; t++) {
          var tagName = artistTags[t].name;
          var tagWeight = parseInt(artistTags[t].count);

          if (
            tagWeight < self.IGNORE_TAG_WEIGHT_UNDER ||
            self.IGNORE_TAGS.indexOf(tagName) > -1
          ) {
            continue;
          }

          if (!countsByTag[tagName]) {
            countsByTag[tagName] = {
              title: tagName,
              counts: new Array(segmentCounts.length+1).join('0').split('').map(parseFloat),
            }
          }

          // Our final weight is:
          // (weight of the tag for the artist) * (playcount)
          countsByTag[tagName].counts[s] += tagWeight * segmentCount;
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

  this.sendAllRequests = function(requests, useLocalStorage, callback) {
    var count = 0;
    var responseData = [];

    async.eachLimit(
      requests,
      this.LAST_FM_API_CONCURRENT_REQUESTS,
      function(url, callback) {
        count++;
        $("#output").html("Sending request " + count + "/" + requests.length);

        var handleResponse = function(data) {
          if (data.error) {
            return;
          }

          // Cache responses
          if (useLocalStorage) {
            window.localStorage[url] = JSON.stringify(data);
          }

          responseData.push(data);
        };

        // Check the cache
        if (window.localStorage[url]) {
          handleResponse(JSON.parse(window.localStorage[url]));
          callback();
        } else {
          $.get(url, function(data) {
            handleResponse(data);
            setTimeout(callback, this.LAST_FM_API_CADENCE_MS);
          }).fail(function(err) {
            console.error("Request failed: " + err);
            setTimeout(callback, this.LAST_FM_API_CADENCE_MS);
          });
        }
      },
      function(err) {
        // All requests finished
        callback(err, responseData);
      }
    );
  }

  this.loadData = function(options, callback) {
    var unixStart = DateStringToUnix(options["time_start"]);
    var unixEnd = DateStringToUnix(options["time_end"]);
    var username = options["username"];
    var groupBy = options["group_by"];
    var minPlays = options["min_plays"];
    var method = options["method"];
    var useLocalStorage = options["use_localstorage"];

    // TODO error checking (date in future, etc.)
    // TODO instead of using localstorage as a request cache, make it smaller
    // by only caching the responses we care about (e.g. if we had a request for
    // RHCP plays, we would cache just the number of plays)

    var allSegments = this.splitTimeSpan(groupBy, unixStart, unixEnd);
    var requestURLs = [];
    for (var i = 0; i < allSegments.length; i++) {
      var segment = allSegments[i];
      var requestParams = {
        user: username,
        from: segment.start,
        to: segment.end,
      };
      var requestMethod = method;

      // TODO magic strings
      // If we're getting tags, we need to do it in two parts
      if (method === "tag") {
        requestMethod = "artist";
      }

      requestURLs.push(this.getAPIRequestURL(requestMethod, requestParams));
    }

    // Send all the requests
    this.sendAllRequests(requestURLs, useLocalStorage, function(err, responses) {
      var segmentData = [];
      for (var i = 0; i < responses.length; i++) {
        segmentData.push(self.parseResponseJSON(responses[i]));
      }

      // Once each segment has been parsed, we just need to join them
      var lastFmData = self.joinSegments(segmentData);

      // If the user wants tags over time, we need to run a second set of requests
      // to get the tags for the album/artist
      if (method == "tag") {
        self.getTagsForArtistData(lastFmData, useLocalStorage, function(err, tagData) {
          tagData = self.cleanByTopN(tagData, self.TAG_TOP_N_COUNT);
          callback(err, tagData);
        });
      } else {
        lastFmData = self.cleanByMinPlays(lastFmData, minPlays);
        callback(err, lastFmData);
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
