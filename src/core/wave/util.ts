/*
  The four algorithms (W, X, Y, Z) cover distinct slope patterns of the
  four peak boundary lines (A, B, C, D). Some slope combinations — like
  flat bottoms or symmetric pinch points — intentionally match NONE of
  them. These "unclassified" peaks represent narrow constriction points
  in the stream where there is no good place for text. The label will
  instead be placed at a neighboring peak where the band is wider.
*/

export interface TextDimensions {
  height: number;
  width: number;
  slope: number;
}

export type MeasureTextFn = (text: string, font: string, fontSize: number) => TextDimensions;

export function createCanvasMeasurer(): MeasureTextFn {
  return (text: string, font: string, fontSize: number): TextDimensions => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    ctx.font = `${fontSize}px ${font}`;
    const metrics = ctx.measureText(text);
    const width = metrics.width;
    // We use fontSize*1.2 rather than actual glyph metrics because this is the
    // measurement the placement algorithms use to decide text size and position.
    // Changing this would alter every label placement across the app. Actual
    // glyph bounds (actualBoundingBoxAscent/Descent) are only used separately
    // for post-render overflow detection, where pixel-accurate bounds matter.
    const height = fontSize * 1.2;
    return { height, width, slope: height / width };
  };
}

/*
  Greedy label placement: picks the highest-count segment first, then
  excludes nearby segments (within segmentsBetweenLabels) so labels
  don't crowd together. This means labels always appear at the most
  prominent peaks for each artist, with guaranteed minimum spacing.
*/
export function findLabelIndices(rippleCounts: number[], segmentsBetweenLabels: number) {
  // Possible points is a list of numbers representing the indices
  // in data.count that are being considered as label points
  // We don't allow for the first or last points to have labels because
  // They would appear off screen
  const possiblePoints = [];
  for (let i = 1; i < rippleCounts.length - 1; i++) {
    possiblePoints.push(i);
  }

  // These are the points we're actually going to use
  const rippleLabelPoints = [];
  while (possiblePoints.length !== 0) {
    // Find max point
    let maxValue = 0;
    let maxIndex = 0;
    possiblePoints.forEach((index) => {
      const value = rippleCounts[index];
      if (value > maxValue) {
        maxValue = value;
        maxIndex = index;
      }
    });

    if (maxValue === 0) {
      break;
    }

    rippleLabelPoints.push(maxIndex);

    // Remove the nearby indices from possiblePoints
    const removeFrom = maxIndex - segmentsBetweenLabels;
    const removeTo = maxIndex + segmentsBetweenLabels;
    for (let r = removeFrom; r < removeTo; r++) {
      const index = possiblePoints.indexOf(r);
      if (index > -1) {
        possiblePoints.splice(index, 1);
      }
    }
  }

  return rippleLabelPoints;
}
