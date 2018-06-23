function WaveGraph() {
    this.title = "Wave Graph";

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

        // Parse data into rickshaw format
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

        // graph = new Rickshaw.Graph()
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

        // Beautify the graph
        graph.render();

        // Add month names

        // Add watermark
    }
}
