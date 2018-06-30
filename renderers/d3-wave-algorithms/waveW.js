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
  var FONT_SIZE_SAFETY_SCALE = 0.75;

  var fontSize = STARTING_FONT_SIZE;
  var leftCollisionX, rightCollisionX;
  var verticalPointyBound, horizontalLeftBound, horizontalRightBound;

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
    if (isW1) {
      verticalInnerBound = verticalPointyBound - fontSize;
    } else {
      verticalInnerBound = verticalPointyBound + fontSize;
    }

    // If we draw a line above our text box, how far can it stretch
    // to the left and right before it hits the sides
    // of our text box?  x = (y - b)/m
    leftCollisionX = (verticalInnerBound - horizontalLeftBound.intercept) / horizontalLeftBound.slope;
    rightCollisionX = (verticalInnerBound - horizontalRightBound.intercept) / horizontalRightBound.slope;

    // This is the available width at this font size
    var availableWidth = rightCollisionX - leftCollisionX;

    var textDimensions = getTextDimensions(text, font, fontSize);
    if (textDimensions.width < availableWidth) {
      fontSize += FONT_SIZE_INTERVAL;
    } else {
      break;
    }
  }

  fontSize *= FONT_SIZE_SAFETY_SCALE;
  
  // Center the text vertically & horizontally
  var textDimensions = getTextDimensions(text, font, fontSize);
  var labelX = peak.bottom.x - (textDimensions.width/2);
  var labelY;
  if (isW1) {
    labelY = peak.top.y - textDimensions.height;
  } else {
    labelY = peak.bottom.y;
  }


  return new Label(text, labelX, labelY, font, fontSize);
}
