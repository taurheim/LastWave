/*
  Returns true if the Z algorithm should be used:
  /\
  \/
*/
function isZType(peak) {
  return (
    peak.A.slope >= 0 &&
    peak.B.slope <= 0 &&
    peak.C.slope <= 0 &&
    peak.D.slope >= 0
  ) || (
    peak.A.slope === 0 &&
    peak.B.slope === 0 &&
    peak.C.slope > 0 &&
    peak.D.slope > 0
  );
}

/*
  High level explanation:
  1. Find midpoint between top right and bottom right
  2. Find midpoint between top left and bottom left
  3. Find midpoint between (1) and (2)
  4. Expand the text box from this point
*/
function getZLabel(peak, text, font) {
  var TEST_FONT_SIZE = 3000;

  var rightMidpoint = new Point(peak.topRight.x, (peak.topRight.y + peak.bottomRight.y)/2);
  var leftMidpoint = new Point(peak.topLeft.x, (peak.topLeft.y + peak.bottomLeft.y)/2);
  var centerPoint = new Point(peak.top.x, (leftMidpoint.y + rightMidpoint.y)/2);

  // Draw two lines from the center point:
  // Forward: Bottom left to top right
  // Backward: Top left to bottom right
  var textDimensions = getTextDimensions(text, font, TEST_FONT_SIZE);
  var forwardLine = new InfiniteLine(textDimensions.slope, centerPoint);
  var backwardLine = new InfiniteLine(textDimensions.slope * -1, centerPoint);

  if (window.debug) {
    window.debugTools.wave.drawLine(forwardLine, "black");
    window.debugTools.wave.drawLine(backwardLine, "white");
    window.debugTools.wave.drawPoint(leftMidpoint, "red");
    window.debugTools.wave.drawPoint(centerPoint, "green");
    window.debugTools.wave.drawPoint(rightMidpoint, "blue");
  }

  // Check all intersections with the peak
  // TODO better naming here
  var checkIntersections = ["A", "B", "C", "D"];
  var minVerticalDistance = Number.MAX_VALUE;
  for (var i = 0; i < checkIntersections.length; i++) {
    var checkLine = peak[checkIntersections[i]];
    var againstLine = (checkLine.slope < 0) ? forwardLine : backwardLine;

    var checkIntersect = checkLine.getIntersect(againstLine);

    var verticalDistance = Math.abs(checkIntersect.y - centerPoint.y);

    if (verticalDistance < minVerticalDistance) {
      minVerticalDistance = verticalDistance;
    }
  }

  // The min vertical distance gives us how much height we have to work with
  var boxHeight = Math.floor(minVerticalDistance*2);
  var heightToFontSizeRatio = textDimensions.height / TEST_FONT_SIZE;
  var fontSize = Math.floor(boxHeight / heightToFontSizeRatio);

  // Position the text on the bottom left corner
  var textPositionX = centerPoint.x - minVerticalDistance/textDimensions.slope;
  var textPositionY = centerPoint.y - boxHeight/2;

  if (window.debug) {
    window.debugTools.wave.drawPoint(new Point(textPositionX, textPositionY));
  }

  return new Label(text, textPositionX, textPositionY, font, fontSize);
}
