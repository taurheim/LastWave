import Point from './Point';
import { RickshawStackPoint } from 'rickshaw';
import LineSegment from '@/renderers/d3-wave/models/LineSegment';

// A peak is a point on the stacked graph that exactly represents
// a value (e.g. 13 plays for Jimi Hendrix in week 2)
// For a graphical representation of each of the members of this
// data structure, check GitHub
export default class Peak {
  top: Point;
  bottom: Point;
  topLeft: Point;
  topRight: Point;
  bottomLeft: Point;
  bottomRight: Point;
  A: LineSegment;
  B: LineSegment;
  C: LineSegment;
  D: LineSegment;

  constructor(index: number, stack: RickshawStackPoint[]) {
    var LEFT_RIGHT_SPREADING_FACTOR = 0.1;

    // 1. Grab all the surrounding points
    // y: The amount of vertical space that the ripple takes up
    // y0: the bottom point of the ripple
    this.top = new Point(stack[index].x, stack[index].y + stack[index].y0);
    this.bottom = new Point(stack[index].x, stack[index].y0);

    if (index === 0) {
      var fakeX = -1 * LEFT_RIGHT_SPREADING_FACTOR;
      var fakeY = this.bottom.y + (this.top.y - this.bottom.y)/2;
      this.topLeft = new Point(fakeX, fakeY);
      this.bottomLeft = new Point(fakeX, fakeY);
    } else {
      this.topLeft = new Point(stack[index - 1].x, stack[index-1].y + stack[index-1].y0);
      this.bottomLeft = new Point(stack[index - 1].x, stack[index - 1].y0);
    }

    if (index === stack.length - 1) {
      var fakeX = this.top.x + LEFT_RIGHT_SPREADING_FACTOR;
      var fakeY = this.bottom.y + (this.top.y - this.bottom.y)/2;
      this.topRight = new Point(fakeX, fakeY);
      this.bottomRight = new Point(fakeX, fakeY);
    } else {
      this.topRight = new Point(stack[index + 1].x, stack[index+1].y + stack[index+1].y0);
      this.bottomRight = new Point(stack[index + 1].x, stack[index+1].y0);
    }

    // 2. Add lines betwen points, labelled A/B/C/D
    this.A = new LineSegment(this.topLeft, this.top);
    this.B = new LineSegment(this.top, this.topRight);
    this.C = new LineSegment(this.bottomLeft, this.bottom);
    this.D = new LineSegment(this.bottom, this.bottomRight);
  }

  // 3. Allow for scaling by linear values
  scale(x: number, y: number): void {
    this.top.scale(x, y);
    this.bottom.scale(x, y);
    this.topLeft.scale(x, y);
    this.topRight.scale(x, y);
    this.bottomLeft.scale(x, y);
    this.bottomRight.scale(x, y);
    this.A.scale(x, y);
    this.B.scale(x, y);
    this.C.scale(x, y);
    this.D.scale(x, y);
  }
}
