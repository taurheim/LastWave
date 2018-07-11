import Point from './Point';
import LineBase from '@/renderers/d3-wave/models/LineBase';

export default class LineSegment extends LineBase {
  start: Point;
  end: Point;

  constructor(start: Point, end: Point) {
    // Swap start and end if start is to the right of end
    if (start.x > end.x) {
      var temp = end;
      end = start;
      start = temp;
    }

    // Calculate the slope ourselves
    var slope = (end.y - start.y) / (end.x - start.x);
    super(slope, start);
    this.start = start;
    this.end = end;
  }

  /*
    Overriding LineBase's implementation
  */
  isXWithinBounds(x: number): boolean {
    return (x >= this.start.x && x <= this.end.x);
  }
}
