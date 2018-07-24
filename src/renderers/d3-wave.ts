import Rickshaw, { RickshawRippleData, RickshawStackData } from 'rickshaw';
import jQuery from 'jquery';
import Renderer from '@/models/Renderer';
import Option from '@/models/Option';
import D3Options from './d3-wave/Options';
import SeriesData from '@/models/SeriesData';
import { DebugWave } from '@/renderers/d3-wave/debugTools';
import d3 from 'd3';
import async from 'async';
import Peak from '@/renderers/d3-wave/models/Peak';
import { findLabelIndices, getTextDimensions } from './d3-wave/util';
import Label from './d3-wave/models/Label';
import { isWType, getWLabel } from './d3-wave/waveW';
import { isXType, getXLabel } from './d3-wave/waveX';
import { isYType, getYLabel } from './d3-wave/waveY';
import { isZType, getZLabel } from './d3-wave/waveZ';
import colorSchemes from '@/config/colors.json';
import LoadingStage from '@/models/LoadingStage';
import store from '@/store';
import { resolve } from 'url';

export default class WaveGraph implements Renderer {
  MINIMUM_SEGMENTS_BETWEEN_LABELS = 3;
  DEFAULT_WIDTH_PER_PEAK = 150;
  RICKSHAW_RENDERER = "area";
  DIV_ID = "svg-wrapper";
  MULTILINE_LINE_HEIGHT = "1em";
  MINIMUM_FONT_SIZE_PIXELS = 8;
  STAGE_NAMES = {
    DRAWING: "Drawing Wave...",
    LABELS: "Adding labels...",
    MONTHS: "Adding month names...",
  }
  title: string = "Wave Graph";

  getOptions(): Option[] {
    return D3Options;
  }

  getLoadingStages(options: any): LoadingStage[] {
    return [
      new LoadingStage(
        this.STAGE_NAMES.DRAWING,
        15,
      ),
      new LoadingStage(
        this.STAGE_NAMES.LABELS,
        80,
      ),
      new LoadingStage(
        this.STAGE_NAMES.MONTHS,
        5,
      )
    ];
  }

  /*
    data should be an array of objects:
    {
      (string) title: e.g. Artist name
      (array of ints) counts: e.g. If there are 12 weeks it would have 12
        indices, each representing how many plays that week had
    }
  */
  renderVisualization(data: SeriesData[], options: any): Promise<void> {
    return new Promise((resolve, reject) => {
      store.commit("startNextStage", 1);

      // Grab the correct color scheme
      var schemeName = options["color_scheme"];
      var schemeColors = colorSchemes[schemeName];
      var colorCount = schemeColors.length;
      var currentColor = 0;
      var self = this;

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
      var rickshawData: RickshawRippleData[] = [];
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
      jQuery("#output").html("Rendering graph...");
      jQuery("#" + this.DIV_ID).html("");
      var graph = new Rickshaw.Graph({
        element: jQuery("#" + this.DIV_ID)[0],
        width: graphWidth,
        height: graphHeight,
        renderer: this.RICKSHAW_RENDERER,
        offset: options.offset,
        stroke: options.stroke,
        preserve: true, // Leave our original data as it is
        series: rickshawData,
      });
      graph.render();

      store.commit("progressCurrentStage");

      // Autoscale options
      const svgDiv = d3.select("#" + this.DIV_ID).select("svg");
      svgDiv.attr('viewBox', `0 0 ${graphWidth} ${graphHeight}`);
      svgDiv.attr('preserveAspectRatio', 'none');

      if (DebugWave.isEnabled || DebugWave.debugRippleName) {
        DebugWave.setSvgDiv(svgDiv);
      }

      // Add ripple labels (e.g. Artist Names)
      if (options.add_labels) {

        store.commit("startNextStage", graph.series.length);
        var scalingValues = this.getScalingValues(graph.series, graphWidth, graphHeight);

        async.each(graph.series, function(rippleData, callback) {
          store.commit("progressCurrentStage");

          if (DebugWave.debugRippleName && DebugWave.debugRippleName == rippleData.name) {
            DebugWave.enable();
          }

          self.addGraphLabels(options.font, rippleData, scalingValues);

          if (DebugWave.debugRippleName && DebugWave.debugRippleName == rippleData.name) {
            DebugWave.disable();
          }

          callback();
        }, function() {
          resolve();
        });
      }

      // Add month names
      store.commit("startNextStage", 1);
      store.commit("progressCurrentStage");

      // Add watermark

    });
  }

  /*
    Draw labels on a ripple
  */
  addGraphLabels (font: string, rippleData: RickshawStackData, scalingValues: {x: number, y: number}) {
    // First find where we should add points
    // Convert our data into a single array
    var rippleCounts = [];
    for (var i = 0; i < rippleData.data.length; i++) {
      rippleCounts.push(rippleData.data[i].y);
    }

    // labelPoints is an array of indices, each one is a
    // peak that we want to add a label to
    // TODO magic #
    var labelIndices = findLabelIndices(rippleCounts, 3);

    for (var i = 0; i < labelIndices.length; i++) {
      var index = labelIndices[i];
      var peak = new Peak(index, rippleData.stack);
      peak.scale(scalingValues.x, scalingValues.y);

      if (DebugWave.isEnabled) {
        DebugWave.drawLine(peak.A, "red");
        DebugWave.drawLine(peak.B, "blue");
        DebugWave.drawLine(peak.C, "green");
        DebugWave.drawLine(peak.D, "yellow");
      }

      this.drawTextOnPeak(rippleData.name, peak, font);
    }
  }

  /*
    Figure out how big the text should be and where it should go
  */
  drawTextOnPeak(text: string, peak: Peak, font: string) {

    if (DebugWave.isEnabled) {
      console.log("Drawing " + text);
      console.log(peak);
    }

    //TODO magic numbers/strings
    var svgDiv = d3.select("#" + this.DIV_ID).select("svg");
    var graphHeight: number = parseInt(svgDiv.attr("height"));

    var label: Label | null;
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
      if (
        (peak.top.y - peak.bottom.y) < (peak.topLeft.y - peak.bottomLeft.y) ||
        (peak.top.y - peak.bottom.y) < (peak.topRight.y - peak.bottomRight.y)
      ) {
        // TODO we can end up here if the height of our peak is less than
        // either of the neighboring peaks. This happens sometimes
        // We can deal with this one of two ways:
        // 1. Come up with more wave algos to handle these cases
        // 2. Move the peak to the left or right by one
        // To test, imagine a continually increasing or decreasing ripple
        return;
      } else {
        throw new Error("Couldn't classify peak. Something went wrong!");
      }
    }

    if (!label) {
      // Couldn't find a meaningful place to put text.
      return;
    }

    if (label.fontSize < this.MINIMUM_FONT_SIZE_PIXELS) {
      return;
    }

    // Sanity check: We shouldn't ever hit this
    // TODO telemetry on this guy
    if (getTextDimensions(label.text, label.font, label.fontSize).height > (peak.top.y - peak.bottom.y)) {
      console.error("One of our algorithms got a font size too big for the space!");
      return;
    }

    if (label.text.indexOf("<br>") > -1) {
      // Assume max one <br>
      var firstLine = label.text.split("<br>")[0];
      var secondLine = label.text.split("<br>")[1];
      svgDiv.append("text")
        .attr("x", label.xPosition)
        .attr("y", graphHeight - label.yPosition)
        .attr("font-size", label.fontSize)
        .attr("font-family", label.font)
        .append("svg:tspan")
          .attr("x", label.xPosition)
          .attr("dy", "-" + this.MULTILINE_LINE_HEIGHT)
          .text(firstLine)
        .append("svg:tspan")
          .attr("x", label.xPosition)
          .attr("dy", this.MULTILINE_LINE_HEIGHT)
          .text(secondLine);
    } else {
      svgDiv.append("text")
        .text(label.text)
        .attr("x", label.xPosition)
        .attr("y", graphHeight - label.yPosition)
        .attr("font-size", label.fontSize)
        .attr("font-family", label.font);
    }
  }

  /*
    The graph data is in a generic format that doesn't correspond with
    pixels on the svg. Scaling values are what we need to multiply the
    graph data values by to get real pixel coordinates in the svg
  */
  getScalingValues(rickshawData: RickshawStackData[], graphWidth: number, graphHeight: number) {
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
