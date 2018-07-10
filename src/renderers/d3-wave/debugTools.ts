window.debugTools = {};
/*
  Debugging tools for d3-wave renderer
*/
window.debugTools["wave"] = new function() {
  this.svgDiv = null;
  this.graphHeight = null;
  this.graphWidth = null;

  this.setSvgDiv = function(d3Handle) {
    console.log("DEBUG: SVG div set.");
    this.svgDiv = d3Handle;
    this.graphHeight = this.svgDiv.attr("height");
    this.graphWidth = this.svgDiv.attr("width");
  }

  this.drawLine = function(debugLine, color) {
    var LINE_WIDTH = 1;

    var start, end;
    if (debugLine instanceof InfiniteLine) {
      start = new Point(0, debugLine.intercept);
      end = new Point(this.graphWidth, debugLine.slope * this.graphWidth + debugLine.intercept);
    } else if (debugLine instanceof LineSegment) {
      start = debugLine.getStartPoint();
      end = debugLine.getEndPoint();
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

  this.drawPoint = function(debugPoint, color) {
    var CIRCLE_RADIUS = 4;

    this.svgDiv.append("circle")
      .attr("r", CIRCLE_RADIUS)
      .attr("cx", debugPoint.x)
      .attr("cy", this.graphHeight - debugPoint.y)
      .attr("fill", color)
      .attr("stroke-width", 5);
  }

  this.drawTextBelowPoint = function(debugPoint, text) {
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
