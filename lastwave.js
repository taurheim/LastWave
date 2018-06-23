
var actions = [new Cloudinary()];
var dataSources = [new LastFm()]; // First will be chosen by default
var renderers = [new WaveGraph()]; // First will be chosen by default

// Entry point for now
$(document).ready(function() {
    console.log("LastWave loaded.");

    CreateOptions();
});

function CreateOptions() {
    console.log("Show all options to the user.");

    // Show all sources
    for(var i=0;i<dataSources.length;++i){
        var source = dataSources[i];
        console.log("Source: " + source.title);

        // Choose the first option
        if (i === 0) LoadDataSourceOptions(source);
    }

    // Show all renderers
    for (var i=0;i<renderers.length;++i){
        var renderer = renderers[i];
        console.log("Renderer: " + renderer.title);

        // Choose the first option
        if (i === 0) LoadRendererOptions(renderer);
    }
}

/*
    When a data source or renderer is chosen, we need to load the
    custom options for it.

    TODO DRY
*/
function LoadDataSourceOptions(source) {
    var options = source.getOptions();
    for (var optionName in options) {
        $("#data-source-options").append(BuildOptionHtml(options[optionName]));
    }
}

function LoadRendererOptions(renderer) {
    var options = renderer.getOptions();
    for (var optionName in options) {
        $("#renderer-options").append(BuildOptionHtml(options[optionName]));
    }
}

function BuildOptionHtml(option) {
    switch(option.type) {
        case "dropdown":
            // TODO check valid
            var dropdownCode = option.title + ": <select>";
            for (var i = 0; i < option.options.length; i++) {
                dropdownCode += "<option>" + option.options[i] + "</option>";
            }
            dropdownCode += "</select>";
            return dropdownCode;
        default:
            return "<span>Not supported: " + JSON.stringify(option) + "</span><br>";
    }
}

function CreateWave() {
    console.log("Creating Wave");

    var selectedDataSource = dataSources[0];
    var selectedRenderer = renderers[0];
    var selectedOptions = {};

    console.log("Perform validation");

    var musicData = selectedDataSource.loadData(selectedOptions);

    selectedRenderer.renderVisualization(musicData, selectedOptions);

    ShowActions();
}

function ShowActions() {
    console.log("Determine which actions can be taken and display them");
    $("body").append("<button onclick=PerformAction()>Action</button>");
}

function PerformAction() {
    console.log("Perform action");
}