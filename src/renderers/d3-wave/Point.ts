function Point(x, y) {
  this.x = x;
  this.y = y;

  this.scale = function(x, y) {
    this.x *= x;
    this.y *= y;
  }

  this.equals = function(otherPoint) {
    return (this.x === otherPoint.x && this.y === otherPoint.y);
  }

  return this;
}
