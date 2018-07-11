export default class Point {
  constructor(public x: number, public y: number) {

  }

  /*
    Scale the point by certain values
  */
  scale(x: number, y: number): void {
    this.x *= x;
    this.y *= y;
  }

  equals(otherPoint: Point): boolean {
    return (this.x === otherPoint.x && this.y === otherPoint.y);
  }
}
