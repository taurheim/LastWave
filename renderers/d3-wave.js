// $.getScript('renderers/d3-wave-algorithms/')

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
        for(var r = 0; r < rickshawData.length; r++) {
            var rippleData = rickshawData[r];
            this.addGraphLabels(rippleData);
            break;
        }

        // Add month names
        console.log(rickshawData);

        // Add watermark
    }

    /*
        Heart of the LastWave algorithm
    */
    this.addGraphLabels = function(rippleData, graphWidth, graphHeight) {
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
            this.scalePeak(peak, graphWidth, graphHeight);
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

    // This turns the points into pixel positions
    this.scalePeak = function(peak, graphWidth, graphHeight) {
        return;
    }
}

// A peak is a point on the stacked graph that exactly represents
// a value (e.g. 13 plays for Jimi Hendrix in week 2)
// For a graphical representation of each of the members of this
// data structure, check GitHub
function Peak(index, stack) {
    var leftRightSpreadingFactor = 0.1;
    console.log("Building peak for index " + index);

    // 1. Grab all the surrounding points
    this.top = new Point(stack[index].x, stack[index].y + stack[index].y0);
    this.bottom = new Point(stack[index].x, stack[index].y);

    if (index === 0) {
        var fakeX = -1 * leftRightSpreadingFactor;
        var fakeY = this.bottom.y + (this.top.y - this.bottom.y)/2;
        this.topLeft = new Point(fakeX, fakeY);
        this.bottomLeft = new Point(fakeX, fakeY);
    } else {
        this.topLeft = new Point(stack[index - 1].x, stack[index-1].y + stack[index].y0);
        this.bottomLeft = new Point(stack[index - 1].x, stack[index - 1].y);
    }

    if (index === stack.length - 1) {
        var fakeX = this.top.x + leftRightSpreadingFactor;
        var fakeY = this.bottom.y + (this.top.y - this.bottom.y)/2;
        this.topRight = new Point(fakeX, fakeY);
        this.bottomRight = new Point(fakeX, fakeY);
    } else {
        this.topRight = new Point(stack[index + 1].x, stack[index+1].y + stack[index].y0);
        this.bottomRight = new Point(stack[index + 1].x, stack[index+1].y);
    }

    // 2. Add lines betwen points, labelled A/B/C/D
    this.A = new Line(this.topLeft, this.top);
    this.B = new Line(this.top, this.topRight);
    this.C = new Line(this.bottomLeft, this.bottom);
    this.D = new Line(this.bottom, this.bottomRight);

    return this;
}

function Point(x, y) {
    this.x = x;
    this.y = y;

    return this;
}

function Line(start, end) {
    this.start = start;
    this.end = end;

    this.slope = (end.y - start.y) / (end.x - start.x);
    this.intercept = start.y - this.slope * start.x;

    return this;
}
