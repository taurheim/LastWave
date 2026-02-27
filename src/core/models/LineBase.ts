import Point from './Point';

export default class LineBase {
  public point: Point;
  public slope: number;
  public intercept: number;
  private FLOAT_PRECISION: number = 4;

  constructor(slope: number, point: Point) {
    this.point = point;
    this.slope = slope;
    this.intercept = point.y - slope * point.x;
  }

  public isXWithinBounds(x: number): boolean {
    return true;
  }

  public scale(x: number, y: number): void {
    // Don't need to scale start/end because it's a reference
    // This is pretty confusing, we should probably clone
    this.intercept *= y;

    this.slope *= y / x;
    this.slope = parseFloat(this.slope.toFixed(this.FLOAT_PRECISION));
  }

  public getIntersect(otherLine: LineBase): Point | null {
    // x = (b1 - b2)/(m2 - m1)
    const intersectX = (this.intercept - otherLine.intercept) / (otherLine.slope - this.slope);

    // Line segment check
    if (!this.isXWithinBounds(intersectX) || !otherLine.isXWithinBounds(intersectX)) {
      return null;
    }

    return this.getPointOnLineAtX(intersectX);
  }

  public getPointOnLineAtX(x: number): Point | null {
    // Line segment check
    if (!this.isXWithinBounds(x)) {
      return null;
    }

    // y = mx + b
    return new Point(x, this.slope * x + this.intercept);
  }
}
