/*
  Returns true if the W algorithm should be used:
  "w1" "w2"
  \/    /\
  \/ or /\
*/
function isWType(peak) {
  return (
    // "w1"
    peak.A.slope > 0 &&
    peak.B.slope < 0 &&
    peak.C.slope > 0 &&
    peak.D.slope < 0
  ) ||
  (
    // "w2"
    peak.A.slope <= 0 &&
    peak.B.slope >= 0 &&
    peak.C.slope < 0 &&
    peak.D.slope > 0
  );
}

/*
  High level explanation:
  The text box should be either touching the "top" point (w1) or the
  "bottom" point (w2). With this assumption, we expand the text box as big
  as it can be.
*/
function getWLabel(peak, text, font) {
  // Config
  var STARTING_FONT_SIZE = 5;
  var FONT_SIZE_INTERVAL = 2;
  var FONT_SIZE_SAFETY_SCALE = 0.9;

  var fontSize = STARTING_FONT_SIZE;
  var leftCollision, rightCollision;
  var verticalPointyBound, horizontalLeftBound, horizontalRightBound;

  // If we don't have enough space, don't even bother
  var minimumHeightRequired = getTextDimensions(text, font, fontSize).height;
  if ((peak.top.y - peak.bottom.y) < minimumHeightRequired) {
    return false;
  }

  // Slightly different code for "w1" vs "w2"
  var isW1 = (peak.A.slope <= 0);

  // We never go past the pointy bound. We expand up/down from it.
  if (isW1) {
    verticalPointyBound = peak.top.y;
    horizontalLeftBound = peak.C;
    horizontalRightBound = peak.D;
  } else {
    verticalPointyBound = peak.bottom.y;
    horizontalLeftBound = peak.A;
    horizontalRightBound = peak.B;
  }


  // Loop
  // TODO explain
  while (true) {
    var verticalInnerBound;
    var textDimensions = getTextDimensions(text, font, fontSize);
    if (isW1) {
      verticalInnerBound = verticalPointyBound - textDimensions.height;
    } else {
      verticalInnerBound = verticalPointyBound + textDimensions.height;
    }

    // If we draw a line above our text box, how far can it stretch
    // to the left and right before it hits the sides
    // of our text box?
    var topLine = new InfiniteLine(0, new Point(0, verticalInnerBound));
    leftCollision = topLine.getIntersect(horizontalLeftBound);
    rightCollision = topLine.getIntersect(horizontalRightBound);

    if (!leftCollision) leftCollision = new Point(peak.topLeft.x, verticalInnerBound);
    if (!rightCollision) rightCollision = new Point(peak.topRight.x, verticalInnerBound);

    // This is the available width at this font size
    var availableWidth = rightCollision.x - leftCollision.x;

    if (window.debug) {
      window.debugTools.wave.drawLine(topLine, "black");
      window.debugTools.wave.drawPoint(leftCollision, "red");
      window.debugTools.wave.drawPoint(rightCollision, "green");
      window.debugTools.wave.drawTextBelowPoint(rightCollision, fontSize);
    }

    if (textDimensions.width < availableWidth) {
      fontSize += FONT_SIZE_INTERVAL;
    } else {
      break;
    }
  }

  fontSize *= FONT_SIZE_SAFETY_SCALE;
  
  // Center the text vertically
  var textDimensions = getTextDimensions(text, font, fontSize);
  var labelY;
  if (isW1) {
    labelY = peak.top.y - textDimensions.height;
  } else {
    labelY = peak.bottom.y;
  }

  var labelX = leftCollision.x;

  return new Label(text, labelX, labelY, font, fontSize);
}
