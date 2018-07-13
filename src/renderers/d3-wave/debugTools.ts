import LineBase from '@/renderers/d3-wave/models/LineBase';
import InfiniteLine from './models/InfiniteLine';
import LineSegment from './models/LineSegment';
import Point from './models/Point';
import d3 from 'd3';

class WaveDebugger {
  isEnabled: boolean = false;
  debugRippleName: string = "female vocalists";

  svgDiv: d3.Selection<d3.BaseType, {}, HTMLElement, any> | undefined;
  graphHeight: number = 0;
  graphWidth: number = 0;

  enable(): void {
    this.isEnabled = true;
  }

  disable(): void {
    this.isEnabled = false;
  }

  setSvgDiv(d3Handle: d3.Selection<d3.BaseType, {}, HTMLElement, any>): void {
    console.log("DEBUG: SVG div set.");
    this.svgDiv = d3Handle;
    this.graphHeight = parseInt(this.svgDiv.attr("height")!);
    this.graphWidth = parseInt(this.svgDiv.attr("width")!);
  }

  drawLine(debugLine: LineBase, color: string) {
    if (!this.svgDiv) return;
    var LINE_WIDTH = 1;

    var start, end;
    if (debugLine instanceof InfiniteLine) {
      start = new Point(0, debugLine.intercept);
      end = new Point(this.graphWidth, debugLine.slope * this.graphWidth + debugLine.intercept);
    } else if (debugLine instanceof LineSegment) {
      start = debugLine.start;
      end = debugLine.end;
    } else {
      throw new Error("Unrecognized line type");
    }
    
    // Draw the line
    this.svgDiv.append("line")
      .attr("x1", start.x)
      .attr("y1", this.graphHeight - start.y)
      .attr("x2", end.x)
      .attr("y2", this.graphHeight - end.y)
      .attr("style", "stroke:" + color + ";stroke-width:" + LINE_WIDTH);
  }

  drawPoint(debugPoint: Point, color: string): void {
    if (!this.svgDiv) return;
    var CIRCLE_RADIUS = 4;

    this.svgDiv.append("circle")
      .attr("r", CIRCLE_RADIUS)
      .attr("cx", debugPoint.x)
      .attr("cy", this.graphHeight - debugPoint.y)
      .attr("fill", color)
      .attr("stroke-width", 5);
  }

  drawTextBelowPoint(debugPoint: Point, text: string): void {
    if (!this.svgDiv) return;
    var FONT_SIZE = 12;
    var FONT_COLOR = "#000000";
    var FONT_FAMILY = "Times New Roman";

    this.svgDiv.append("text")
      .text(text)
      .attr("x", debugPoint.x)
      .attr("y", this.graphHeight - (debugPoint.y - FONT_SIZE))
      .attr("font-size", FONT_SIZE)
      .attr("fill", FONT_COLOR)
      .attr("font-family", FONT_FAMILY);
  }
}

export const DebugWave = new WaveDebugger();
