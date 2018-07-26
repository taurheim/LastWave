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
import { convertSeriesToRickshawFormat, drawRickshawGraph } from '@/renderers/d3-wave/rickshawUtil';
import Promise from 'bluebird';
const WatermarkLogoPath = require('@/assets/logo.svg');

export default class WaveGraph implements Renderer {
  public title: string = 'Wave Graph';
  private MINIMUM_SEGMENTS_BETWEEN_LABELS = 3;
  private DEFAULT_WIDTH_PER_PEAK = 150;
  private RICKSHAW_RENDERER = 'area';
  private DIV_ID = 'svg-wrapper';
  private MULTILINE_LINE_HEIGHT = '1em';
  private MINIMUM_FONT_SIZE_PIXELS = 8;
  private STAGE_NAMES = {
    DRAWING: 'Drawing Wave...',
    LABELS: 'Adding labels...',
    MONTHS: 'Adding month names...',
  };

  public getOptions(): Option[] {
    return D3Options;
  }

  public getLoadingStages(options: any): LoadingStage[] {
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
  public renderVisualization(data: SeriesData[], options: any): Promise<void> {
    return new Promise((resolve, reject) => {
      store.commit('startNextStage', 1);

      // Grab the correct color scheme
      const schemeName = options.color_scheme;
      const schemeColors = colorSchemes[schemeName];
      const self = this;
      const graphHeight = options.height;
      // Calculate the width if it hasn't been set
      let graphWidth = options.width;
      if (!graphWidth) {
        graphWidth = data[0].counts.length * this.DEFAULT_WIDTH_PER_PEAK;
      }

      const rickshawData = convertSeriesToRickshawFormat(data, schemeColors);
      const graph = drawRickshawGraph(
        rickshawData,
        jQuery('#' + this.DIV_ID)[0],
        graphWidth,
        graphHeight,
        this.RICKSHAW_RENDERER,
        options.offset,
        options.stroke,
      );

      store.commit('progressCurrentStage');

      // Autoscale options
      const svgDiv = d3.select(`#${this.DIV_ID}`).select('svg');
      svgDiv.attr('viewBox', `0 0 ${graphWidth} ${graphHeight}`);
      svgDiv.attr('preserveAspectRatio', 'none');

      if (DebugWave.isEnabled || DebugWave.debugRippleName) {
        DebugWave.setSvgDiv(svgDiv);
      }

      // Add ripple labels (e.g. Artist Names)
      if (options.add_labels) {
        store.commit('startNextStage', graph.series.length);
        const scalingValues = this.getScalingValues(graph.series, graphWidth, graphHeight);

        Promise.each(graph.series, (rippleData) => {
          store.commit('progressCurrentStage');

          if (DebugWave.debugRippleName && DebugWave.debugRippleName == rippleData.name) {
            DebugWave.enable();
          }

          self.addGraphLabels(options.font, rippleData, scalingValues);

          if (DebugWave.debugRippleName && DebugWave.debugRippleName == rippleData.name) {
            DebugWave.disable();
          }
        }).then(() => {
          // Add month names
          if (options.add_months) {
            // TODO hack
            // The way I have options set up in general is kind of dumb. Maybe options should just be a single object
            // that gets shared between the renderer and data source? Or maybe it's better if there's a way to grab
            // them from the renderer if it exists or something, dunno
            const dateStart = store.state.dataSourceOptions.time_start;
            const dateEnd = store.state.dataSourceOptions.time_end;
            this.addMonthNames(svgDiv, dateStart, dateEnd);
          }

          this.drawWatermark(svgDiv);

          resolve();
        });
      }
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

  private addMonthNames(
    svgDiv: d3.Selection<d3.BaseType, {}, HTMLElement, any>,
    dateStart: Date,
    dateEnd: Date,
  ) {
    // TODO hack
    // d3 doesn't support prepend so we append a div for the months to the first <g> in the svg
    const monthsDiv = svgDiv.select('g').append('g');
    monthsDiv.attr('id', 'months');
    const graphWidth = parseInt(svgDiv.attr('width'), 10);
    const graphHeight = parseInt(svgDiv.attr('height'), 10);
    const MS_TO_PX_RATIO = (dateEnd.getTime() - dateStart.getTime()) / graphWidth;

    // For now, synchronous and one step
    store.commit('startNextStage', 1);

    // Find the first month boundary

    let currentDate = dateStart;
    const endTime = dateEnd.getTime();
    while (currentDate.getTime() < endTime) {
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);

      const monthName = currentDate.toLocaleString('en-us', { month: 'long'});
      const msFromStart = currentDate.getTime() - dateStart.getTime();
      const pxFromLeft = Math.floor(msFromStart / MS_TO_PX_RATIO);

      // Draw a line
      this.drawMonthLine(monthsDiv, monthName, pxFromLeft, graphHeight);
    }

    // Finished
    store.commit('progressCurrentStage');
  }

  private drawMonthLine(
    monthDiv: d3.Selection<d3.BaseType, {}, HTMLElement, any>,
    monthName: string,
    pxFromLeft: number,
    graphHeight: number,
  ) {
    const MONTH_FONT_FAMILY = 'Roboto';
    const MONTH_FONT_SIZE = 30;
    const STROKE_WIDTH = 5;
    const STROKE_OPACITY = 0.2;
    const COLOR = '#AAA';
    const LINE_BOTTOM_PADDING = 50;
    const TEXT_BOTTOM_PADDING = 10;
    const textDimensions = getTextDimensions(monthName, MONTH_FONT_FAMILY, MONTH_FONT_SIZE);

    monthDiv.append('line')
      .attr('x1', pxFromLeft)
      .attr('y1', 0)
      .attr('x2', pxFromLeft)
      .attr('y2', graphHeight - LINE_BOTTOM_PADDING)
      .attr('style', `stroke:${COLOR};stroke-width:${STROKE_WIDTH};stroke-opacity:${STROKE_OPACITY};`);

    monthDiv.append('text')
      .text(monthName)
      .attr('x', pxFromLeft - textDimensions.width / 2)
      .attr('y', graphHeight - TEXT_BOTTOM_PADDING - MONTH_FONT_SIZE)
      .attr('fill', COLOR)
      .attr('font-family', MONTH_FONT_FAMILY)
      .attr('font-size', MONTH_FONT_SIZE);
  }

  private drawWatermark(svgDiv: d3.Selection<d3.BaseType, {}, HTMLElement, any>) {
    // TODO scale watermark based on svg size
    const WATERMARK_TEXT = 'savas.ca/lastwave';
    const WATERMARK_FONT = 'Roboto';
    const WATERMARK_FONT_WEIGHT = '100';
    const WATERMARK_FONT_SIZE = 40;
    const WATERMARK_BOTTOM_PADDING = 10;
    const WATERMARK_OPACITY = 0.4;
    const WATERMARK_LOGO = WatermarkLogoPath;
    const WATERMARK_LOGO_HEIGHT = 30;
    const WATERMARK_LOGO_WIDTH = 50;
    const WATERMARK_LOGO_OPACITY = 0.8;
    const watermarkDimensions = getTextDimensions(WATERMARK_TEXT, WATERMARK_FONT, WATERMARK_FONT_SIZE);
    const graphWidth = parseInt(svgDiv.attr('width'), 10);
    const graphHeight = parseInt(svgDiv.attr('height'), 10);

    svgDiv.append('text')
      .text(WATERMARK_TEXT)
      .attr('x', graphWidth - watermarkDimensions.width)
      .attr('y', graphHeight - WATERMARK_BOTTOM_PADDING)
      .attr('font-size', WATERMARK_FONT_SIZE)
      .attr('font-family', WATERMARK_FONT)
      .attr('font-weight', WATERMARK_FONT_WEIGHT)
      .style('opacity', WATERMARK_OPACITY);

    svgDiv.append('svg:image')
      .attr('xlink:href', WATERMARK_LOGO)
      .attr('x', graphWidth - watermarkDimensions.width - WATERMARK_LOGO_WIDTH)
      .attr('y', graphHeight - WATERMARK_BOTTOM_PADDING - WATERMARK_LOGO_HEIGHT)
      .attr('height', WATERMARK_LOGO_HEIGHT)
      .attr('width', WATERMARK_LOGO_WIDTH)
      .attr('opacity', WATERMARK_LOGO_OPACITY);
  }
}
