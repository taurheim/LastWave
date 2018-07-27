import Point from './Point';
import LineBase from '@/renderers/d3-wave/models/LineBase';

export default class LineSegment extends LineBase {
  public start: Point;
  public end: Point;

  constructor(start: Point, end: Point) {
    // Swap start and end if start is to the right of end
    if (start.x > end.x) {
      const temp = end;
      end = start;
      start = temp;
    }

    // Calculate the slope ourselves
    const slope = (end.y - start.y) / (end.x - start.x);
    super(slope, start);
    this.start = start;
    this.end = end;
  }

  /*
    Overriding LineBase's implementation
  */
  public isXWithinBounds(x: number): boolean {
    return (x >= this.start.x && x <= this.end.x);
  }
}
