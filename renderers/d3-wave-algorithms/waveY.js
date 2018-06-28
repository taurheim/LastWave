/*
  Returns true if the Y algorithm should be used:
  "y1" "y2" "y3" "y4"
  /\    /\  \\   //
  // or \\  \/   \/
*/
function isYType(peak) {
  return (
    // y1
    peak.A.slope > 0 &&
    peak.B.slope < 0 &&
    peak.C.slope >= 0 &&
    peak.D.slope > 0
  ) ||
  (
    // y2
    peak.A.slope > 0 &&
    peak.B.slope < 0 &&
    peak.C.slope < 0 &&
    peak.D.slope <= 0
  ) ||
  (
    // y3
    peak.A.slope <= 0 &&
    peak.B.slope < 0 &&
    peak.C.slope < 0 &&
    peak.D.slope > 0
  ) ||
  (
    // y4
    peak.A.slope > 0 &&
    peak.B.slope >= 0 &&
    peak.C.slope < 0 &&
    peak.D.slope > 0
  );
}

/*
  "Bounce" algorithm. See https://medium.com/@savas/lastwave-1-text-placement-9aba7fe4ede6

  Helpful diagram:
                   o\   line V
                  /    \  (2)|
        line O  /        (  \|
              /       (      |
         (1)/      X         /
          / )    (         / |
        /      Q        /    |
        |     (  )   /  line U
        |   (      o         |
        | (  ____ / start_po |
        |  /           int   |
*/
function getYLabel(peak, text, font) {
  var TEST_FONT_SIZE = 3000;
  var ITERATION_CACHE_SIZE = 2;
  var MAXIMUM_ITERATIONS = 100;
  var TYPE = {
    Y1: 0,
    Y2: 1,
    Y3: 2,
    Y4: 3,
  };
  var SETUP_CONFIG = {};
  SETUP_CONFIG[TYPE.Y1] = {
    startPoint: "bottom",
    slopeModifier: -1,
    opposite: "A",
    adjacent: "D",
    across: "B",
  };
  SETUP_CONFIG[TYPE.Y2] = {
    startPoint: "bottom",
    slopeModifier: 1,
    opposite: "B",
    adjacent: "C",
    across: "A",
  };
  SETUP_CONFIG[TYPE.Y3] = {
    startPoint: "top",
    slopeModifier: 1,
    opposite: "C",
    adjacent: "B",
    across: "D",
  };
  SETUP_CONFIG[TYPE.Y4] = {
    startPoint: "top",
    slopeModifier: -1,
    opposite: "D",
    adjacent: "A",
    across: "C",
  };

  /*
    TODO merge this and the first method to figure out if it's Y type
  */
  var peakType;
  if (peak.A.slope <= 0) {
    peakType = TYPE.Y3;
  } else if (peak.B.slope > 0) {
    peakType = TYPE.Y4;
  } else if (peak.C.slope > 0) {
    peakType = TYPE.Y1;
  } else {
    peakType = TYPE.Y2;
  }

  /*
    Returns a new start point
  */
  var performIteration = function(startPoint, fontSlope, opposite, across, adjacent) {
    // Find out where our opposite and font lines intersect
    var fontLine = new InfiniteLine(fontSlope, startPoint);

    // Short Circuit 1: Check if our line intersects across
    var acrossIntersect = across.getIntersect(fontLine);
    if (acrossIntersect) {
      // End the iteration here, picking the new start point to be
      // along adjacent with the same X value as the intersection
      var newStartX = acrossIntersect.x;
      var newStartY = adjacent.getPointOnLineAtX(newStartX);
      return new Point(newStartX, newStartY);
    }

    // Pick the collision point to continue the iteration
    var collisionPoint = opposite.getIntersect(fontLine);

    // If we don't have a collision, then we need to give a fake one
    if (!collisionPoint) {
      // Choose the outside point of the opposite line
      if (peakType === TYPE.Y1 || peakType === TYPE.Y3) {
        collisionPoint = opposite.getStartPoint();
      } else {
        collisionPoint = opposite.getEndPoint();
      }
    }

    // Draw the inverted line
    // It has the same X as the collisionPoint, and the same Y as startPoint
    // and goes in the opposite slope direction
    var invertedStart = new Point(collisionPoint.x, startPoint.y);
    var invertedLine = new InfiniteLine(fontSlope*-1, invertedStart);

    // Short Circuit 2: Check if our line intersects adjacent
    var adjacentIntersect = adjacent.getIntersect(invertedLine);
    if(adjacentIntersect) {
      return adjacentIntersect;
    }

    // Where does our inverted line collide with across?
    var invertIntersect = across.getIntersect(invertedLine);

    // If we don't have a collision, we need to give a fake one
    if (!invertIntersect) {
      // http://i.imgur.com/61YmgJt.png Just misses V
      if (peakType === TYPE.Y1 || peakType === TYPE.Y3) {
        invertIntersect = across.getEndPoint();
      } else {
        invertIntersect = across.getStartPoint();
      }
    }

    // Our new start point is at this X position, but on the adjacent line
    var newStartX = invertIntersect.x;
    var newStartY = adjacent.getPointOnLineAtX(invertIntersect.x);
    var newStart = new Point(newStartX, newStartY);

    // Short Circuit 3: Check if our font line will intersect across
    var shortCircuitLine = new InfiniteLine(fontSlope, newStart);
    if (across.getIntersect(shortCircuitLine)) {
      return startPoint;
    }

    return newStart;
  }

  /*
    Figure out what font size an iteration will allow for
  */
  var calculateFontSize = function(text, startPoint, fontSlope, opposite) {
    // Where is our end point?
    var fontLine = new InfiniteLine(fontSlope, startPoint);
    var endPoint = fontLine.getIntersect(opposite);

    if (!endPoint) {
      throw new Error("[waveY] Couldn't calculate font size");
    }

    var boxHeight = Math.abs(startPoint.y - endPoint.y);
    var fontSize = Math.floor(boxHeight / heightToFontSizeRatio);

    return fontSize;
  }

  /*
    Set up initial state
  */
  var cfg = SETUP_CONFIG[peakType];
  var startPoint = peak[cfg.startPoint];
  var opposite = peak[cfg.opposite];
  var adjacent = peak[cfg.adjacent];
  var across = peak[cfg.across];
  var textDimensions = getTextDimensions(text, font, TEST_FONT_SIZE);
  var heightToFontSizeRatio = textDimensions.height / TEST_FONT_SIZE;
  var fontSlope = textDimensions.slope * cfg.slopeModifier;

  // Hold on to previous iterations to check for bounces
  var iterationCache = new Array(ITERATION_CACHE_SIZE);
  var shouldIterate = true;
  var iterationCount = 0;

  // Iterate!
  while(shouldIterate) {
    startPoint = performIteration(startPoint, fontSlope, opposite, across, adjacent);
    console.log("Iteration " + iterationCount + " : " + JSON.stringify(startPoint));

    // Calculate our new font size
    fontSize = calculateFontSize(text, startPoint, fontSlope, opposite);

    // Sometimes we "bounce" between two (or three) different spots. In this case,
    // just stop the algorithm
    for(var i = 0; i < iterationCache.length; i++) {
      if (iterationCache[i] === fontSize) {
        shouldIterate = false;
      }
    }

    // Add to our font size cache
    iterationCache.shift();
    iterationCache.push(fontSize);

    iterationCount++;
    if (iterationCount > MAXIMUM_ITERATIONS) {
      shouldIterate = false;
    }
  }

  var textPosition = startPoint;

  // The text is anchored to the bottom left, but textPosition likely isn't
  // (it lies on the "adjacent" line)
  var finalDimensions = getTextDimensions(text, font, fontSize);
  var textHeight = finalDimensions.height;
  var textWidth = finalDimensions.width;
  if (peakType === TYPE.Y1 || peakType === TYPE.Y3) {
    // Horizontal flip 
    textPosition.x -= textWidth;
  }
  if (peakType === TYPE.Y3 || peakType === TYPE.Y4) {
    // Vertical flip
    textPosition.y -= textHeight;
  }

  return new Label(text, textPosition.x, textPosition.y, font, fontSize);
}
