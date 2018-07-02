// $.getScript('renderers/d3-wave-algorithms/waveW.js')
// $.getScript('renderers/d3-wave-algorithms/waveX.js')
// $.getScript('renderers/d3-wave-algorithms/waveY.js')
// $.getScript('renderers/d3-wave-algorithms/waveZ.js')

function WaveGraph() {
  window.debug = false;
  // window.debugText = "Kendrick Lamar";

  this.title = "Wave Graph";
  
  // Config
  this.MINIMUM_SEGMENTS_BETWEEN_LABELS = 3;
  this.DEFAULT_WIDTH_PER_PEAK = 150;
  this.DEFAULT_GRAPH_HEIGHT = 600;
  this.RICKSHAW_RENDERER = "area";
  this.DIV_ID = "visualization";

  this.getOptions = function() {
    return {
      "color_scheme": {
        "title": "Color Scheme",
        "type": "dropdown",
        "options": [
          "lastwave"
        ],
      },
      "width": {
        "title": "Graph width",
        "type": "int",
      },
      "height": {
        "title": "Graph height",
        "type": "int",
        "default": this.DEFAULT_GRAPH_HEIGHT,
      },
      "offset": {
        "title": "Graph type",
        "type": "dropdown",
        "options": [
          "silhouette",
          "wiggle",
          "expand",
          "zero",
        ],
      },
      "stroke": {
        "title": "Ripple border",
        "type": "toggle",
        "default": true,
      },
      "font": {
        "title": "Font",
        "type": "string",
        "default": "Roboto",
      },
      "add_labels": {
        "title": "Add labels",
        "type": "toggle",
        "default": true,
      }
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

    // Calculate the width if it hasn't been set
    var graphWidth = options.width;
    if (!graphWidth) {
      graphWidth = data[0].counts.length * this.DEFAULT_WIDTH_PER_PEAK;
    }
    var graphHeight = options.height;

    // Create the wave graph using Rickshaw/d3
    $("#" + this.DIV_ID).html("");
    var graph = new Rickshaw.Graph({
      element: $("#" + this.DIV_ID)[0],
      width: graphWidth,
      height: graphHeight,
      renderer: this.RICKSHAW_RENDERER,
      offset: options.offset,
      stroke: options.stroke,
      preserve: true, // Leave our original data as it is
      series: rickshawData,
    });
    graph.render();

    if (window.debug || window.debugText) {
      window.debugTools.wave.setSvgDiv(d3.select("#" + this.DIV_ID).select("svg"));
    }

    // Add ripple labels (e.g. Artist Names)
    if (options.add_labels) {
      var scalingValues = this.getScalingValues(rickshawData, graphWidth, graphHeight);
      for(var r = 0; r < rickshawData.length; r++) {
        var rippleData = rickshawData[r];

        if (window.debugText && window.debugText === rippleData.name) {
          window.debug = true;
        }

        this.addGraphLabels(options.font, rippleData, scalingValues);

        if (window.debugText && window.debugText === rippleData.name) {
          window.debug = false;
        }
      }
    }

    // Add month names

    // Add watermark
  }

  /*
    Draw labels on a ripple
  */
  this.addGraphLabels = function(font, rippleData, scalingValues) {
    // First find where we should add points
    // Convert our data into a single array
    var rippleCounts = [];
    for (var i = 0; i < rippleData.data.length; i++) {
      rippleCounts.push(rippleData.data[i].y);
    }

    // labelPoints is an array of indices, each one is a
    // peak that we want to add a label to
    var labelIndices = this.findLabelIndices(rippleCounts);

    for (var i = 0; i < labelIndices.length; i++) {
      var index = labelIndices[i];
      var peak = new Peak(index, rippleData.stack);
      peak.scale(scalingValues.x, scalingValues.y);

      if (window.debug) {
        window.debugTools.wave.drawLine(peak.A, "red");
        window.debugTools.wave.drawLine(peak.B, "blue");
        window.debugTools.wave.drawLine(peak.C, "green");
        window.debugTools.wave.drawLine(peak.D, "yellow");
      }

      this.drawTextOnPeak(rippleData.name, peak, font);
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

  /*
    Figure out how big the text should be and where it should go
  */
  this.drawTextOnPeak = function(text, peak, font) {

    if (window.debug) {
      console.log("Drawing " + text);
      console.log(peak);
    }

    //TODO magic numbers/strings
    var svgDiv = d3.select("#" + this.DIV_ID).select("svg");
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
      var graphWidth = svgDiv.attr("width");
      if (peak.topLeft.x === 0 || peak.topRight.x === graphWidth) {
        // TODO this happens because we choose the second
        // time segment as our labelling point, and right now we ignore
        // the first time segment (the one that touches the edge of the graph)
        // We can end up in position where we're drawing a label on a peak
        // that's not a local maximum. For now let's just ignore.
        return;
      } else {
        throw new Error("Couldn't classify peak. Something went wrong!");
      }
    }

    if (label === false) {
      // Couldn't find a meaningful place to put text.
      return;
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
  var LEFT_RIGHT_SPREADING_FACTOR = 0.1;

  // 1. Grab all the surrounding points
  // y: The amount of vertical space that the ripple takes up
  // y0: the bottom point of the ripple
  this.top = new Point(stack[index].x, stack[index].y + stack[index].y0);
  this.bottom = new Point(stack[index].x, stack[index].y0);

  if (index === 0) {
    var fakeX = -1 * LEFT_RIGHT_SPREADING_FACTOR;
    var fakeY = this.bottom.y + (this.top.y - this.bottom.y)/2;
    this.topLeft = new Point(fakeX, fakeY);
    this.bottomLeft = new Point(fakeX, fakeY);
  } else {
    this.topLeft = new Point(stack[index - 1].x, stack[index-1].y + stack[index-1].y0);
    this.bottomLeft = new Point(stack[index - 1].x, stack[index - 1].y0);
  }

  if (index === stack.length - 1) {
    var fakeX = this.top.x + LEFT_RIGHT_SPREADING_FACTOR;
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
