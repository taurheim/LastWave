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
