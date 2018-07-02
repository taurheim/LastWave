/*
  Returns true if the X algorithm should be used:
  "x1" "x2"
   \\  //
   \\  //
*/
function isXType(peak) {
  return (
    // "x1"
    peak.A.slope <= 0 &&
    peak.B.slope < 0 &&
    peak.C.slope < 0 &&
    peak.D.slope <= 0
  ) ||
  (
    // "x2"
    peak.A.slope > 0 &&
    peak.B.slope >= 0 &&
    peak.C.slope >= 0 &&
    peak.D.slope > 0
  )
}

/*
  High level explanation:
  Scan for the point of maximum width, then expand the text box at this
  height.
*/
function getXLabel(peak, text, font) {
  var TEST_FONT_SIZE = 3000;
  var MINIMUM_SPACE_PX = 1;

  var isX1 = peak.A.slope < 0;

  // 1. Running from bottom to top, find the maximum width point
  var maxWidth = 0;
  var maxWidthY, maxWidthLeftCollisionX;
  var leftCollisionX, rightCollisionX;
  var bottomY = peak.bottom.y + 1;
  var topY = peak.top.y - 1;

  // If there is less than a pixel between the top and bottom,
  // we can't fit any meaningful text here.
  if ((topY - bottomY) < MINIMUM_SPACE_PX) {
    return false;
  }

  var leftCollidingLine, rightCollidingLine;
  if (isX1) {
    leftCollidingLine = peak.C;
    rightCollidingLine = peak.B;
  } else {
    leftCollidingLine = peak.A;
    rightCollidingLine = peak.D;
  }

  for (var testY = bottomY; testY < topY; testY++) {
    // x = (y - b) / m;
    leftCollisionX = (testY - leftCollidingLine.intercept) / leftCollidingLine.slope;
    rightCollisionX = (testY - rightCollidingLine.intercept) / rightCollidingLine.slope;

    // If any of these collisions are outside the bounds, cut them off
    // TODO this could be made even better by allowing text to cross multiple peaks
    // for particularly big areas
    if (leftCollisionX < peak.topLeft.x) leftCollisionX = peak.topLeft.x;
    if (rightCollisionX > peak.topRight.x) rightCollisionX = peak.topRight.x;

    // Update maximum
    var width = rightCollisionX - leftCollisionX;
    if(width > maxWidth) {
      maxWidth = width;
      maxWidthY = testY;
      maxWidthLeftCollisionX = leftCollisionX;
    }
  }

  // 2. Get the "slope" of our text. This is effectively a diagonal that we're going
  // to try to expand as much as possible to fit our text in
  var textDimensions = getTextDimensions(text, font, TEST_FONT_SIZE);
  var heightToFontSizeRatio = textDimensions.height / TEST_FONT_SIZE;
  var textSlope = textDimensions.slope;

  // The slope of our text should have the opposite slope to our peak
  if (!isX1) {
    textSlope *= -1;
  }

  var textCenter = new Point(maxWidthLeftCollisionX + maxWidth/2, maxWidthY);

  // 3. Now figure out how long we can make this line (extend it up and down)
  var textLine = new InfiniteLine(textSlope, textCenter);
  var leftTextCollision = leftCollidingLine.getIntersect(textLine);
  var rightTextCollision = rightCollidingLine.getIntersect(textLine);

  // There are two situations where we might not collide:
  // 1. The textLine actually hits a different line on the top/bottom
  // --> We need to check if the other line has a collision
  // 2. The textline goes through a wide gap on left/right
  // --> Use the outer bounds
  // Situation #1
  if (!leftTextCollision) {
    if (isX1) {
      leftTextCollision = peak.D.getIntersect(textLine);
    } else {
      leftTextCollision = peak.B.getIntersect(textLine);
    }
  }
  if (!rightTextCollision) {
    if (isX1) {
      rightTextCollision = peak.A.getIntersect(textLine);
    } else {
      rightTextCollision = peak.C.getIntersect(textLine);
    }
  }

  // Situation #2
  if (!leftTextCollision) {
    leftTextCollision = textLine.getPointOnLineAtX(leftCollidingLine.getStartPoint().x);
  }
  if (!rightTextCollision) {
    rightTextCollision = textLine.getPointOnLineAtX(rightCollidingLine.getEndPoint().x);
  }

  // 4. Figure out what font size we can fit (same as the height of the line we just extended)
  var boxHeight = Math.abs(parseInt(leftTextCollision.y - rightTextCollision.y));
  var fontSize = Math.floor(boxHeight / heightToFontSizeRatio);

  if (window.debug) {
    window.debugTools.wave.drawLine(new LineSegment(
      new Point(leftCollisionX, maxWidthY),
      new Point(rightCollisionX, maxWidthY)
    ), "green");
    window.debugTools.wave.drawLine(textLine, "black");
    window.debugTools.wave.drawPoint(leftTextCollision, "red");
    window.debugTools.wave.drawPoint(textCenter, "blue");
    window.debugTools.wave.drawPoint(rightTextCollision, "green");
  }

  return new Label(text, leftTextCollision.x, leftTextCollision.y, font, fontSize);
}
