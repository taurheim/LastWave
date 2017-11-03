
var actions = [new Cloudinary()];
var dataSources = [new LastFm()];
var renderers = [new WaveGraph()];

// Entry point for now
$(document).ready(function() {
    console.log("LastWave loaded.");

    CreateOptions();
});

function CreateOptions() {
    console.log("Show all options to the user.");

    // Show all sources
    for(var i=0;i<dataSources.length;++i){
        console.log("Source: <name>");
    }

    // Show all renderers
    for (var i=0;i<renderers.length;++i){
        console.log("Renderer: <name>");
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