import Peak from '@/renderers/d3-wave/models/Peak';
import Label from '@/renderers/d3-wave/models/Label';
import { getTextDimensions } from '@/renderers/d3-wave/util';
import { DebugWave } from '@/renderers/d3-wave/debugTools';
import Point from '@/renderers/d3-wave/models/Point';
import LineSegment from '@/renderers/d3-wave/models/LineSegment';
import InfiniteLine from '@/renderers/d3-wave/models/InfiniteLine';
import store from '@/store';

/*
  Returns true if the Y algorithm should be used:
  "y1" "y2" "y3" "y4"
  /\    /\  \\   //
  // or \\  \/   \/
*/
export function isYType(peak: Peak) {
  return (
    // y1
    peak.A.slope > 0 &&
    peak.B.slope < 0 &&
    peak.C.slope > 0 &&
    peak.D.slope >= 0
  ) ||
    (
      // y2
      peak.A.slope > 0 &&
      peak.B.slope < 0 &&
      peak.C.slope <= 0 &&
      peak.D.slope < 0
    ) ||
    (
      // y3
      peak.A.slope < 0 &&
      peak.B.slope <= 0 &&
      peak.C.slope < 0 &&
      peak.D.slope > 0
    ) ||
    (
      // y4
      peak.A.slope >= 0 &&
      peak.B.slope > 0 &&
      peak.C.slope < 0 &&
      peak.D.slope > 0
    );
}

enum PEAK_TYPE {
  Y1,
  Y2,
  Y3,
  Y4,
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
class WaveConfig {
  constructor(
    public startPoint: string,
    public slopeModifier: number,
    public opposite: string,
    public adjacent: string,
    public across: string,
  ) {
  }
}
/*
  Returns a new start point for the bounce algorithm
*/
const performIteration = (
  startPoint: Point,
  fontSlope: number,
  opposite: LineSegment,
  across: LineSegment,
  adjacent: LineSegment,
  peakType: PEAK_TYPE,
) => {
  // Find out where our opposite and font lines intersect
  const fontLine = new InfiniteLine(fontSlope, startPoint);

  if (DebugWave.isEnabled) {
    DebugWave.drawLine(fontLine, 'black');
  }

  // Short Circuit 1: Check if our line intersects across
  const acrossIntersect = across.getIntersect(fontLine);
  if (acrossIntersect) {
    // End the iteration here, picking the new start point to be
    // along adjacent with the same X value as the intersection
    return adjacent.getPointOnLineAtX(acrossIntersect.x);
  }

  // Pick the collision point to continue the iteration
  let collisionPoint = opposite.getIntersect(fontLine);

  // If we don't have a collision, then we need to give a fake one
  if (!collisionPoint) {
    // Choose the outside point of the opposite line
    if (peakType === PEAK_TYPE.Y1 || peakType === PEAK_TYPE.Y3) {
      collisionPoint = opposite.start;
    } else {
      collisionPoint = opposite.end;
    }
  }

  // Draw the inverted line
  // It has the same X as the collisionPoint, and the same Y as startPoint
  // and goes in the opposite slope direction
  const invertedStart = new Point(collisionPoint.x, startPoint.y);
  const invertedLine = new InfiniteLine(fontSlope * -1, invertedStart);

  if (DebugWave.isEnabled) {
    DebugWave.drawPoint(collisionPoint, 'purple');
    DebugWave.drawPoint(invertedStart, 'green');
    DebugWave.drawLine(invertedLine, 'orange');
  }

  // Short Circuit 2: Check if our line intersects adjacent
  const adjacentIntersect = adjacent.getIntersect(invertedLine);
  if (adjacentIntersect) {
    // Edge case: We hit the adjacent line but we don't have enough space
    // to calculate the font size. In this case, perform half an iteration
    // right here. TODO this should probably happen in a different place?
    // seems weird to have it almost perform another full iteration...
    const fixFontLine = new InfiniteLine(fontSlope, adjacentIntersect);
    const scAcrossIntersect = across.getIntersect(fixFontLine);
    if (scAcrossIntersect) {
      return adjacent.getPointOnLineAtX(scAcrossIntersect.x);
    }

    // If not this edge case, then just give back our most recent collision point
    return adjacentIntersect;
  }

  // Where does our inverted line collide with across?
  let invertIntersect = across.getIntersect(invertedLine);

  // If we don't have a collision, we need to give a fake one
  if (!invertIntersect) {
    // http://i.imgur.com/61YmgJt.png Just misses V
    if (peakType === PEAK_TYPE.Y1 || peakType === PEAK_TYPE.Y3) {
      invertIntersect = across.end;
    } else {
      invertIntersect = across.start;
    }
  }

  // Our new start point is at this X position, but on the adjacent line
  const newStart = adjacent.getPointOnLineAtX(invertIntersect.x);

  if (!newStart) {
    return null;
  }

  // Short Circuit 3: Check if our font line will intersect across
  const shortCircuitLine = new InfiniteLine(fontSlope, newStart);
  if (across.getIntersect(shortCircuitLine)) {
    return startPoint;
  }

  return newStart;
};

/*
  Figure out what font size an iteration will allow for
*/
const calculateFontSize = (
  text: string,
  startPoint: Point,
  fontSlope: number,
  opposite: LineSegment,
  heightToFontSizeRatio: number,
) => {
  // Where is our end point?
  const fontLine = new InfiniteLine(fontSlope, startPoint);
  let endPoint = fontLine.getIntersect(opposite);

  if (DebugWave.isEnabled) {
    DebugWave.drawLine(fontLine, 'cyan');
  }

  if (!endPoint) {
    // If we miss opposite altogether, let's just stop there.
    endPoint = fontLine.getPointOnLineAtX(
      Math.min(
        opposite.start.x,
        opposite.end.y,
      ),
    );
    store.commit('log', `Had to emergency fix ${text}`);
    if (!endPoint) {
      return null;
    }
  }

  const boxHeight = Math.abs(startPoint.y - endPoint.y);
  const fontSize = Math.floor(boxHeight / heightToFontSizeRatio);

  return fontSize;
};

export function getYLabel(peak: Peak, text: string, font: string): Label | null {
  const TEST_FONT_SIZE = 3000;
  const ITERATION_CACHE_SIZE = 2;
  const MAXIMUM_ITERATIONS = 100;
  const TYPE = {
    Y1: 0,
    Y2: 1,
    Y3: 2,
    Y4: 3,
  };
  const SETUP_CONFIG: { [key: number]: WaveConfig } = {};
  SETUP_CONFIG[TYPE.Y1] = {
    startPoint: 'bottom',
    slopeModifier: -1,
    opposite: 'A',
    adjacent: 'D',
    across: 'B',
  };
  SETUP_CONFIG[TYPE.Y2] = {
    startPoint: 'bottom',
    slopeModifier: 1,
    opposite: 'B',
    adjacent: 'C',
    across: 'A',
  };
  SETUP_CONFIG[TYPE.Y3] = {
    startPoint: 'top',
    slopeModifier: 1,
    opposite: 'C',
    adjacent: 'B',
    across: 'D',
  };
  SETUP_CONFIG[TYPE.Y4] = {
    startPoint: 'top',
    slopeModifier: -1,
    opposite: 'D',
    adjacent: 'A',
    across: 'C',
  };

  /*
    TODO merge this and the first method to figure out if it's Y type
  */
  let peakType: number;
  if (peak.A.slope < 0) {
    peakType = TYPE.Y3;
  } else if (peak.B.slope > 0) {
    peakType = TYPE.Y4;
  } else if (peak.C.slope > 0) {
    peakType = TYPE.Y1;
  } else {
    peakType = TYPE.Y2;
  }

  if (DebugWave.isEnabled) {
    store.commit('log', `Peak type: ${peakType}`);
  }



  /*
    Set up initial state
  */
  const cfg = SETUP_CONFIG[peakType];
  let startPoint = (peak as any)[cfg.startPoint];
  const opposite = (peak as any)[cfg.opposite];
  const adjacent = (peak as any)[cfg.adjacent];
  const across = (peak as any)[cfg.across];
  const textDimensions = getTextDimensions(text, font, TEST_FONT_SIZE);
  const heightToFontSizeRatio = textDimensions.height / TEST_FONT_SIZE;
  const fontSlope = textDimensions.slope * cfg.slopeModifier;

  // Hold on to previous iterations to check for bounces
  const iterationCache = new Array(ITERATION_CACHE_SIZE);
  let shouldIterate = true;
  let iterationCount = 0;
  let fontSize: number = 0;

  // Iterate!
  while (shouldIterate) {

    if (DebugWave.isEnabled) {
      DebugWave.drawPoint(startPoint, 'red');
      DebugWave.drawTextBelowPoint(startPoint, iterationCount.toString());
      store.commit('log', `Iteration ${iterationCount}: ${JSON.stringify(startPoint)}`);
    }
    let newStartPoint = performIteration(startPoint, fontSlope, opposite, across, adjacent, peakType);

    if (!newStartPoint) {
      return null;
    }

    // Calculate our new font size
    const newFontSize = calculateFontSize(text, newStartPoint, fontSlope, opposite, heightToFontSizeRatio);
    if (!newFontSize) {
      return null;
    }
    fontSize = newFontSize;

    // Sometimes we "bounce" between two (or three) different spots. In this case,
    // just stop the algorithm (and go back to the last spot)
    iterationCache.forEach((pastIterationFontSize) => {
      if (pastIterationFontSize === fontSize) {
        shouldIterate = false;
        // Go back to the last start point
        newStartPoint = startPoint;
      }
    });

    // Add to our font size cache
    iterationCache.shift();
    iterationCache.push(fontSize);

    iterationCount++;
    if (iterationCount > MAXIMUM_ITERATIONS) {
      shouldIterate = false;
    }

    // Set up for next iteration
    startPoint = newStartPoint;
  }

  const textPosition = startPoint;

  // The text is anchored to the bottom left, but textPosition likely isn't
  // (it lies on the "adjacent" line)
  const finalDimensions = getTextDimensions(text, font, fontSize);
  const textHeight = finalDimensions.height;
  const textWidth = finalDimensions.width;
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
