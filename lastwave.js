
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

    // Create the options global
    window.lastwaveOptions = {
        dataSource: {},
        renderer: {}
    };

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
function updateOption(lastwaveModule, optionName) {
    // Silly closures
    return function(optionValue) {
        console.log("Setting (" + optionName + ") to (" + optionValue + ")");
        window.lastwaveOptions[lastwaveModule][optionName] = optionValue;
    }
}

function LoadDataSourceOptions(source) {
    var options = source.getOptions();
    var parentDiv = $("#data-source-options");
    for (var optionName in options) {
        CreateOption(parentDiv, options[optionName], updateOption("dataSource", optionName));
    }
}

function LoadRendererOptions(renderer) {
    var options = renderer.getOptions();
    var parentDiv = $("#renderer-options");
    for (var optionName in options) {
        CreateOption(parentDiv, options[optionName], updateOption("renderer", optionName));
    }
}

function CreateOption(parentDiv, option, callbackOnChange) {
    var optionDiv = $('<div></div>');

    switch(option.type) {
        case "dropdown":
            // TODO @option for validity

            // Build dropdown
            var dropdown = $('<select></select>');
            for (var i = 0; i < option.options.length; i++) {
                dropdown.append("<option>" + option.options[i] + "</option>");
            }

            // First one is selected
            callbackOnChange(option.options[0]);

            // Bind callback
            dropdown.change(function() {
                callbackOnChange(dropdown.val());
            });

            optionDiv.append(option.title + ': ');
            optionDiv.append(dropdown);
            parentDiv.append(optionDiv);
            break;
        case "int":
            // Build input
            var inputDiv = $('<input type="text">');
            optionDiv.append(option.title + ": ");
            optionDiv.append(inputDiv);

            // Bind callback
            inputDiv.change(function() {
                callbackOnChange($(this).val());
            });

            // Report default if necessary
            if(option.default) {
                callbackOnChange(option.default);
            }
            break;
        case "toggle":
            var checkboxDiv = $('<input type="checkbox"></input>');
            if (option.default) {
                checkboxDiv.prop('checked', true);
            }
            optionDiv.append(option.title + ': ');

            optionDiv.append(checkboxDiv);

            // Bind callback
            checkboxDiv.change(function() {
                callbackOnChange(this.checked);
            });

            // Report default (if no default, off)
            callbackOnChange(option.default ? true : false);
            break;
        case "string":
            var inputDiv = $('<input type="text"></input>');

            if (option.default) {
                inputDiv.prop("value", option.default);
                callbackOnChange(option.default);
            }

            inputDiv.change(function() {
                callbackOnChange($(this).val());
            });

            optionDiv.append(option.title + ': ');
            optionDiv.append(inputDiv);
            break;
        case "date":
            var inputDiv = $('<input type="text"></input>');

            if (option.default) {
                inputDiv.prop("value", option.default);
                callbackOnChange(option.default);
            }

            inputDiv.change(function() {
                callbackOnChange($(this).val());
            });

            optionDiv.append(option.title + ': ');
            optionDiv.append(inputDiv);
            break;
        default:
            optionDiv.append('Not supported: ' + JSON.stringify(option));
            break;
    }

    parentDiv.append(optionDiv);
}

function CreateWave() {
    console.log("Creating Wave");

    var selectedDataSource = dataSources[0];
    var selectedRenderer = renderers[0];
    var dataSourceOptions = window.lastwaveOptions.dataSource;
    var rendererOptions = window.lastwaveOptions.renderer;

    console.log("Perform validation");

    selectedDataSource.loadData(dataSourceOptions, function(err, musicData) {
        // While last.fm isn't hooked up!
        // musicData = window.demoData;

        selectedRenderer.renderVisualization(musicData, rendererOptions);

        ShowActions();
    });
}

function ShowActions() {
    console.log("Determine which actions can be taken and display them");
    $("body").append("<button onclick=PerformAction()>Action</button>");
}

function PerformAction() {
    console.log("Perform action");
}
