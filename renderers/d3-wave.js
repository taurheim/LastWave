// $.getScript('renderers/d3-wave-algorithms/')

function WaveGraph() {
    this.title = "Wave Graph";
    
    // Config
    this.minimumSegmentsBetweenLabels = 4;

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
        this.addGraphLabels();

        // Add month names

        // Add watermark
    }

    /*
        Heart of the LastWave algorithm
    */
    this.addGraphLabels = function() {
        console.log("Adding labels to graph...");
    }

    /*
        A "Label Point" is where we are adding a label on a ripple.
        @param list of counts for a ripple
        @return list of indices, each one should have a label
    */
    this.findLabelPoints = function(rippleCounts) {
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
}
