function getTextDimensions(text, font, fontSize) {
  var temp = $("<div>" + text + "</div>")
    .css({
      position: "absolute",
      float: "left", 
      "white-space": "nowrap",
      font: fontSize + "px " + font,
      visibility: "hidden",
    })
    .appendTo($("body"));
  temp.css("line-height", "1em");
  var width = temp.width();
  var height = temp.height();

  temp.remove();

  return {
    height: height,
    width: width,
    slope: height / width,
  };
}

  /*
    A "Label Point" is where we are adding a label on a ripple.
    @param list of counts for a ripple
    @return list of indices, each one should have a label
  */
  this.findLabelIndices = function(rippleCounts) {
    // Possible points is a list of numbers representing the indices
    // in data.count that are being considered as label points
    // We don't allow for the first or last points to have labels because
    // They would appear off screen
    var possiblePoints = [];
    for (var i = 1; i < rippleCounts.length - 1; i++) {
      possiblePoints.push(i);
    }

    // These are the points we're actually going to use
    var rippleLabelPoints = [];
    while (possiblePoints.length !== 0) {
      // Find max point
      var maxValue = 0;
      var maxIndex = 0;
      for (var i = 0; i < possiblePoints.length; i++) {
        var index = possiblePoints[i];
        var value = rippleCounts[index];
        if (value > maxValue) {
          maxValue = value;
          maxIndex = index;
        }
      }

      if (maxValue === 0) break;

      rippleLabelPoints.push(maxIndex);

      // Remove the nearby indices from possiblePoints
      var removeFrom = maxIndex - this.MINIMUM_SEGMENTS_BETWEEN_LABELS;
      var removeTo = maxIndex + this.MINIMUM_SEGMENTS_BETWEEN_LABELS;
      for(var r = removeFrom; r < removeTo; r++) {
        var index = possiblePoints.indexOf(r);
        if (index > -1) {
          possiblePoints.splice(index, 1);
        }
      }
    }

    return rippleLabelPoints;
  }
