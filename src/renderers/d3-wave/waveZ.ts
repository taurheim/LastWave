import Peak from '@/renderers/d3-wave/models/Peak';
import Point from '@/renderers/d3-wave/models/Point';
import { getTextDimensions } from '@/renderers/d3-wave/util';
import InfiniteLine from '@/renderers/d3-wave/models/InfiniteLine';
import { DebugWave } from '@/renderers/d3-wave/debugTools';
import Label from '@/renderers/d3-wave/models/Label';

/*
  Returns true if the Z algorithm should be used:
  /\
  \/
*/
export function isZType(peak: Peak) {
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
export function getZLabel(peak: Peak, text: string, font: string): Label | null {
  const TEST_FONT_SIZE = 3000;

  const rightMidpoint = new Point(peak.topRight.x, (peak.topRight.y + peak.bottomRight.y) / 2);
  const leftMidpoint = new Point(peak.topLeft.x, (peak.topLeft.y + peak.bottomLeft.y) / 2);
  const centerPoint = new Point(peak.top.x, (leftMidpoint.y + rightMidpoint.y) / 2);

  // Draw two lines from the center point:
  // Forward: Bottom left to top right
  // Backward: Top left to bottom right
  const textDimensions = getTextDimensions(text, font, TEST_FONT_SIZE);
  const forwardLine = new InfiniteLine(textDimensions.slope, centerPoint);
  const backwardLine = new InfiniteLine(textDimensions.slope * -1, centerPoint);


  if (DebugWave.isEnabled) {
    DebugWave.drawLine(forwardLine, 'black');
    DebugWave.drawLine(backwardLine, 'white');
    DebugWave.drawPoint(leftMidpoint, 'red');
    DebugWave.drawPoint(centerPoint, 'green');
    DebugWave.drawPoint(rightMidpoint, 'blue');
  }

  // Check all intersections with the peak
  // TODO better naming here
  const checkIntersections = ['A', 'B', 'C', 'D'];
  let minVerticalDistance = Number.MAX_VALUE;
  checkIntersections.forEach((lineName) => {
    const checkLine = (peak as any)[lineName];
    const againstLine = (checkLine.slope < 0) ? forwardLine : backwardLine;

    const checkIntersect = checkLine.getIntersect(againstLine);

    // If there is no intersect, we don't have to worry about that
    // line segment reducing the space for our text.
    if (checkIntersect) {
      const verticalDistance = Math.abs(checkIntersect.y - centerPoint.y);

      if (verticalDistance < minVerticalDistance) {
        minVerticalDistance = verticalDistance;
      }
    }

  });

  // The min vertical distance gives us how much height we have to work with
  const boxHeight = Math.floor(minVerticalDistance * 2);
  const heightToFontSizeRatio = textDimensions.height / TEST_FONT_SIZE;
  const fontSize = Math.floor(boxHeight / heightToFontSizeRatio);

  // Position the text on the bottom left corner
  const textPositionX = centerPoint.x - minVerticalDistance / textDimensions.slope;
  const textPositionY = centerPoint.y - boxHeight / 2;

  if (DebugWave.isEnabled) {
    DebugWave.drawPoint(new Point(textPositionX, textPositionY), 'red');
  }

  return new Label(text, textPositionX, textPositionY, font, fontSize);
}
