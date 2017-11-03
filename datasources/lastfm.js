/**
 * Implements DataSource
 */
function LastFm() {
    // Send an api every __ ms
    var LAST_FM_API_CADENCE_MS = 250;

    this.getOptions = function() {
        return {
            "username": {
                "type": "string",
                "default": "Taurheim"
            },
            "time_start": {
                "type": "date",
                "default": ""
            },
            "time_end": {
                "type": "date",
                "default": ""
            }
        }
    }

    this.loadData = function(options) {
        var unixStart = RoundWeek(options["time_start"]);
        var unixEnd = RoundWeek(options["time_end"]);

        // TODO error checking (date in future, etc.)
        
        // Send get request every X seconds (use async.js)

        /*
            GET: "http://ws.audioscrobbler.com/2.0/?method=user.getweeklyartistchart&user="+user+"&api_key=27ca6b1a0750cf3fb3e1f0ec5b432b72&from="+week_start+"&to="+week_end
        */

        // Parse the data into the right format
    }
}

/**
 * Util
 */

/**
 * Convert from date in format YY/MM/DD to unix timestamp
 */
function DateStringToUnix(dateString) {

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