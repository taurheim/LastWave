import Point from './Point';
import LineSegment from './LineSegment';

export interface StackPoint {
  x: number;
  y: number;
  y0: number;
}

// A peak is a point on the stacked graph that exactly represents
// a value (e.g. 13 plays for Jimi Hendrix in week 2)
// For a graphical representation of each of the members of this
// data structure, check GitHub
export default class Peak {
  public top: Point;
  public bottom: Point;
  public topLeft: Point;
  public topRight: Point;
  public bottomLeft: Point;
  public bottomRight: Point;
  public A: LineSegment;
  public B: LineSegment;
  public C: LineSegment;
  public D: LineSegment;

  constructor(index: number, stack: StackPoint[]) {
    // Compute the actual spacing between data points for edge extrapolation
    const spacing = stack.length >= 2
      ? stack[Math.min(index + 1, stack.length - 1)].x - stack[Math.max(index - 1, 0)].x
        || stack[1].x - stack[0].x
      : 1;
    const halfSpacing = spacing / 2;

    // 1. Grab all the surrounding points
    // y: The amount of vertical space that the ripple takes up
    // y0: the bottom point of the ripple
    this.top = new Point(stack[index].x, stack[index].y + stack[index].y0);
    this.bottom = new Point(stack[index].x, stack[index].y0);

    if (index === 0) {
      // Extrapolate left: band tapers to zero thickness at one interval away
      const fakeLeftX = this.top.x - halfSpacing;
      const fakeLeftY = this.bottom.y + (this.top.y - this.bottom.y) / 2;
      this.topLeft = new Point(fakeLeftX, fakeLeftY);
      this.bottomLeft = new Point(fakeLeftX, fakeLeftY);
    } else {
      this.topLeft = new Point(stack[index - 1].x, stack[index - 1].y + stack[index - 1].y0);
      this.bottomLeft = new Point(stack[index - 1].x, stack[index - 1].y0);
    }

    if (index === stack.length - 1) {
      // Extrapolate right: band tapers to zero thickness at one interval away
      const fakeRightX = this.top.x + halfSpacing;
      const fakeRightY = this.bottom.y + (this.top.y - this.bottom.y) / 2;
      this.topRight = new Point(fakeRightX, fakeRightY);
      this.bottomRight = new Point(fakeRightX, fakeRightY);
    } else {
      this.topRight = new Point(stack[index + 1].x, stack[index + 1].y + stack[index + 1].y0);
      this.bottomRight = new Point(stack[index + 1].x, stack[index + 1].y0);
    }

    // 2. Add lines betwen points, labelled A/B/C/D
    this.A = new LineSegment(this.topLeft, this.top);
    this.B = new LineSegment(this.top, this.topRight);
    this.C = new LineSegment(this.bottomLeft, this.bottom);
    this.D = new LineSegment(this.bottom, this.bottomRight);
  }

  // 3. Allow for scaling by linear values
  public scale(x: number, y: number): void {
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
