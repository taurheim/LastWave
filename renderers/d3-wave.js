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
                data: [(13)],
                name: "Caribou"
            }]
        */
        var rickshawData = [];
        for(var i = 0; i < data.length; i++) {
            var dataPoint = data[i];
            var title = dataPoint.title;
            var counts = dataPoint.counts;
            var color = schemeColors[currentColor++ % colorCount];

            rickshawData.push({
                name: title,
                data: counts,
                color: color,
            });
        }

        // graph = new Rickshaw.Graph()

        // Beautify the graph

        // Add month names

        // Add watermark
    }
}
