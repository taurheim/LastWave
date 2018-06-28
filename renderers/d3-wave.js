// $.getScript('renderers/d3-wave-algorithms/waveW.js')
// $.getScript('renderers/d3-wave-algorithms/waveX.js')
// $.getScript('renderers/d3-wave-algorithms/waveY.js')
// $.getScript('renderers/d3-wave-algorithms/waveZ.js')

function WaveGraph() {
  this.title = "Wave Graph";
  
  // Config
  this.minimumSegmentsBetweenLabels = 4;
  this.leftRightSpreadingFactor = 0.1;

  this.getOptions = function() {
    return {
      "color_scheme": {
        "title": "Color Scheme",
        "type": "dropdown",
        "options": [
          "lastwave"
        ],
      },
    };
  };

  /*
    data should be an array of objects:
    {
      (string) title: e.g. Artist name
      (array of ints) counts: e.g. If there are 12 weeks it would have 12
        indices, each representing how many plays that week had
    }
  */
  this.renderVisualization = function(data, options) {
    console.log("Rendering Visualization");

    // Grab the correct color scheme
    var schemeName = options.color_scheme;
    var schemeColors = ColorSchemes[schemeName];
    var colorCount = schemeColors.length;
    var currentColor = 0;

    // Parse ripple data into rickshaw format
    /*
      [{
        color: "#ffffff",
        data: [{
          x: <int, which time segment?>
          y: <int, count in that time segment>
        }],
        name: "Caribou"
      }]
    */
    var rickshawData = [];
    for(var i = 0; i < data.length; i++) {
      var dataPoint = data[i];
      var title = dataPoint.title;
      var color = schemeColors[currentColor++ % colorCount];

      var counts = dataPoint.counts;
      var rickshawSeriesData = [];
      for (var j = 0; j < counts.length; j++) {
        rickshawSeriesData.push({
          x: j,
          y: counts[j],
        });
      }

      rickshawData.push({
        name: title,
        data: rickshawSeriesData,
        color: color,
      });
    }

    // Create the wave graph using Rickshaw/d3
    var graph = new Rickshaw.Graph({
      element: $("#visualization")[0],
      width: 1000,
      height: 600,
      renderer: 'area',
      offset: 'silhouette',
      stroke: true,
      preserve: true,
      series: rickshawData,
      fill: "#000000",
    });
    graph.render();

    // Add ripple labels (e.g. Artist Names)
    var scalingValues = this.getScalingValues(rickshawData, 1000, 600);
    console.log("Scaling values: " + JSON.stringify(scalingValues));
    for(var r = 0; r < rickshawData.length; r++) {
      var rippleData = rickshawData[r];
      this.addGraphLabels(rippleData, scalingValues);
    }

    console.log("Rickshaw data: ");
    console.log(rickshawData);

    // Add month names

    // Add watermark
  }

  /*
    Draw labels on a ripple
  */
  this.addGraphLabels = function(rippleData, scalingValues) {
    console.log("Adding labels to graph...");

    // First find where we should add points
    // Convert our data into a single array
    var rippleCounts = [];
    for (var i = 0; i < rippleData.data.length; i++) {
      rippleCounts.push(rippleData.data[i].y);
    }

    // labelPoints is an array of indices, each one is a
    // peak that we want to add a label to
    var labelIndices = this.findLabelIndices(rippleCounts);
    console.log("Indices found: " + labelIndices);

    for (var i = 0; i < labelIndices.length; i++) {
      var index = labelIndices[i];
      var peak = new Peak(index, rippleData.stack);
      peak.scale(scalingValues.x, scalingValues.y);
      this.drawTextOnPeak(rippleData.name, peak);
    }
  }

  /*
    A "Label Point" is where we are adding a label on a ripple.
    @param list of counts for a ripple
    @return list of indices, each one should have a label
  */
  this.findLabelIndices = function(rippleCounts) {
    // Possible points is a list of numbers representing the indices
    // in data.count that are being considered as label points
    var possiblePoints = [];
    for (var i = 0; i < rippleCounts.length; i++) {
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
      var removeFrom = maxIndex - this.minimumSegmentsBetweenLabels;
      var removeTo = maxIndex + this.minimumSegmentsBetweenLabels;
      for(var r = removeFrom; r < removeTo; r++) {
        var index = possiblePoints.indexOf(r);
        if (index > -1) {
          possiblePoints.splice(index, 1);
        }
      }
    }

    return rippleLabelPoints;
  }

  /*
    Figure out how big the text should be and where it should go
  */
  this.drawTextOnPeak = function(text, peak, font) {
    console.log("Attempting to draw " + text + " on peak");

    //TODO magic numbers/strings
    var svgDiv = d3.select("#visualization").select("svg");
    var graphHeight = svgDiv.attr("height");

    var label;
    if (isWType(peak)) {
      label = getWLabel(peak, text, font);
    } else if (isXType(peak)) {
      label = getXLabel(peak, text, font);
    } else if (isYType(peak)) {
      label = getYLabel(peak, text, font);
    } else if (isZType(peak)) {
      label = getZLabel(peak, text, font);
    } else {
      console.log("Couldn't classify peak. Something went wrong!");
    }

    svgDiv.append("text")
      .text(label.text)
      .attr("x", label.x)
      .attr("y", graphHeight - label.y)
      .attr("font-size", label.fontSize)
      .attr("font-family", label.font);
  }

  /*
    The graph data is in a generic format that doesn't corespond with
    pixels on the svg. Scaling values are what we need to multiply the
    graph data values by to get real pixel coordinates in the svg
  */
  this.getScalingValues = function(rickshawData, graphWidth, graphHeight) {
    // The maximum y0 value corresponds with the height of the graph
    var maxy0 = 0;
    // The last ripple is on top
    var lastRipple = rickshawData[rickshawData.length - 1];
    for (var i = 0; i < lastRipple.stack.length; i++) {
      var peakData = lastRipple.stack[i];
      var peakHeight = peakData.y + peakData.y0;
      if (peakHeight > maxy0) {
        maxy0 = peakHeight;
      }
    }

    return {
      x: graphWidth / (rickshawData[0].stack.length - 1),
      y: graphHeight / maxy0,
    }
  }
}

// A peak is a point on the stacked graph that exactly represents
// a value (e.g. 13 plays for Jimi Hendrix in week 2)
// For a graphical representation of each of the members of this
// data structure, check GitHub
function Peak(index, stack) {
  var leftRightSpreadingFactor = 0.1;

  // 1. Grab all the surrounding points
  // y: The amount of vertical space that the ripple takes up
  // y0: the bottom point of the ripple
  this.top = new Point(stack[index].x, stack[index].y + stack[index].y0);
  this.bottom = new Point(stack[index].x, stack[index].y0);

  console.log("Peak: " + JSON.stringify(this.top));

  if (index === 0) {
    var fakeX = -1 * leftRightSpreadingFactor;
    var fakeY = this.bottom.y + (this.top.y - this.bottom.y)/2;
    this.topLeft = new Point(fakeX, fakeY);
    this.bottomLeft = new Point(fakeX, fakeY);
  } else {
    this.topLeft = new Point(stack[index - 1].x, stack[index-1].y + stack[index-1].y0);
    this.bottomLeft = new Point(stack[index - 1].x, stack[index - 1].y0);
  }

  if (index === stack.length - 1) {
    var fakeX = this.top.x + leftRightSpreadingFactor;
    var fakeY = this.bottom.y + (this.top.y - this.bottom.y)/2;
    this.topRight = new Point(fakeX, fakeY);
    this.bottomRight = new Point(fakeX, fakeY);
  } else {
    this.topRight = new Point(stack[index + 1].x, stack[index+1].y + stack[index+1].y0);
    this.bottomRight = new Point(stack[index + 1].x, stack[index+1].y0);
  }

  // 2. Add lines betwen points, labelled A/B/C/D
  this.A = new LineSegment(this.topLeft, this.top);
  this.B = new LineSegment(this.top, this.topRight);
  this.C = new LineSegment(this.bottomLeft, this.bottom);
  this.D = new LineSegment(this.bottom, this.bottomRight);

  // 3. Allow for scaling by linear values
  this.scale = function(x, y) {
    this.top.scale(x, y);
    this.bottom.scale(x, y);
    this.topLeft.scale(x, y);
    this.topRight.scale(x, y);
    this.bottomLeft.scale(x, y);
    this.bottomRight.scale(x, y);
    this.A.scale(x, y);
    this.B.scale(x, y);
    this.C.scale(x, y);
    this.D.scale(x, y);
  }

  return this;
}

function Point(x, y) {
  this.x = x;
  this.y = y;

  this.scale = function(x, y) {
    this.x *= x;
    this.y *= y;
  }

  this.equals = function(otherPoint) {
    return (this.x === otherPoint.x && this.y === otherPoint.y);
  }

  return this;
}

/*
  A label contains all the information necessary to draw
  text on the SVG
*/
function Label(text, xPosition, yPosition, font, fontSize) {
  this.text = text;
  this.x = xPosition;
  this.y = yPosition;
  this.font = font;
  this.fontSize = fontSize
  return this;
}

function getTextDimensions(text, font, fontSize) {
  var temp = $("<div>" + text + "</div>")
    .css({
      position: "absolute",
      float: "left", 
      "white-space": "nowrap",
      visibility: "hidden",
      font: fontSize + "px " + font,
    })
    .appendTo($("body"));
  var width = temp.width();
  var height = temp.height();

  temp.remove();

  return {
    height: height,
    width: width,
    slope: height / width,
  };
}
