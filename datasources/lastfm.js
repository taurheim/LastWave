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
  };
  this.API_KEY = "27ca6b1a0750cf3fb3e1f0ec5b432b72";
  this.API_URL = "http://ws.audioscrobbler.com/2.0/";
    this.API_URL += "?method={method}";
    this.API_URL += "&user={user}";
    this.API_URL += "&api_key=" + this.API_KEY;
    this.API_URL += "&from={from}";
    this.API_URL += "&to={to}";
  this.API_RESPONSE_ROOT_DIV_TAG = "lfm";
  this.LFM_IGNORE_NODE_NAME = "#text";
  this.LFM_NAME_TAG = "name";
  this.LFM_PLAYS_TAG = "playcount";
  this.LFM_ARTIST_TAG = "artist";
  this.ALBUM_NAME_FORMAT = '{album}<br>{artist}';

  this.getOptions = function() {
    var today = new Date();
    var defaultStartDate = new Date();
    defaultStartDate.setMonth(today.getMonth() - 3);
    defaultStartDate.setDate(today.getDate() - 5);
    defaultStartDate.setFullYear(today.getFullYear() - 1);
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
          "month",
          "week",
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
          "album",
          "artist",
        ],
      }
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

  this.getAPIRequestURL = function(method, username, startDate, endDate) {
    var url = this.API_URL;
    url = url.replace("{method}", this.METHODS[method]);
    url = url.replace("{user}", username);
    url = url.replace("{from}", startDate);
    url = url.replace("{to}", endDate);
    return url;
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
    return data.filter(function(obj) {
      var maxPlays = 0;
      for (var i = 0; i < obj.counts.length; i++) {
        var playCount = obj.counts[i];
        if(playCount > maxPlays) maxPlays = playCount;
      }

      return maxPlays >= minPlays;
    });
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

      var plays = segmentData.getElementsByTagName(self.LFM_PLAYS_TAG)[0].childNodes[0].nodeValue;
      counts.push({
        name: name,
        count: plays,
      });
    }

    return counts;
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

  this.sendAllRequests = function(requests, callback) {
    var count = 0;
    var responseData = [];
    async.eachLimit(
      requests,
      this.LAST_FM_API_CONCURRENT_REQUESTS,
      function(url, callback) {
        count++;
        $("#output").html("Sending request " + count + "/" + requests.length);
        $.get(url, function(data) {
          responseData.push(data);
          setTimeout(callback, this.LAST_FM_API_CADENCE_MS);
        });
      }
    , function(err) {
      // All requests finished
      callback(err, responseData);
    });
  }

  this.loadData = function(options, callback) {
    var unixStart = DateStringToUnix(options["time_start"]);
    var unixEnd = DateStringToUnix(options["time_end"]);
    var username = options["username"];
    var groupBy = options["group_by"];
    var minPlays = options["min_plays"];
    var method = options["method"];

    // TODO error checking (date in future, etc.)

    var allSegments = this.splitTimeSpan(groupBy, unixStart, unixEnd);
    var requestURLs = [];
    for (var i = 0; i < allSegments.length; i++) {
      var segment = allSegments[i];
      requestURLs.push(this.getAPIRequestURL(method, username, segment.start, segment.end));
    }

    // Send all the requests
    this.sendAllRequests(requestURLs, function(err, responses) {
      var segmentData = [];
      for (var i = 0; i < responses.length; i++) {
        segmentData.push(self.parseResponseDoc(responses[i]));
      }

      // Once each segment has been parsed, we just need to join them
      var lastFmData = self.joinSegments(segmentData);

      console.log("Ripples before cleaning: " + lastFmData.length);
      lastFmData = self.cleanByMinPlays(lastFmData, minPlays);
      console.log("Ripples after cleaning: " + lastFmData.length);

      callback(err, lastFmData);
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
