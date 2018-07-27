import jQuery from 'jquery';

export function getTextDimensions(text: string, font: string, fontSize: number) {
  const temp = jQuery('<div>' + text + '</div>')
    .css({
      'position': 'absolute',
      'float': 'left',
      'white-space': 'nowrap',
      'font': fontSize + 'px ' + font,
      'visibility': 'hidden',
    })
    .appendTo(jQuery('body'));
  temp.css('line-height', '1em');
  const width = temp.width();
  const height = temp.height();

  if (!width || !height) {
    throw new Error('Couldn\'t get width or height');
  }

  temp.remove();

  return {
    height,
    width,
    slope: height / width,
  };
}

/*
  A "Label Point" is where we are adding a label on a ripple.
  @param list of counts for a ripple
  @return list of indices, each one should have a label
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
