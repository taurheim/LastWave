// Base class for lines
function LineBase(slope, point) {
  var FLOAT_PRECISION = 4;
  /*
    Constructor
    @param slope
    @param point A point on the line
  */
  this.slope = slope;
  this.intercept = point.y - this.slope * point.x;

  /*
    To be overridden.
  */
  this.isXWithinBounds = function(x) {
    return true;
  }

  /*
    Scale the line & points by linear values in the X and Y direction
  */
  this.scale = function(x, y) {
    // Don't need to scale start/end because it's a reference
    // This is pretty confusing, we should probably clone
    this.intercept *= y;

    this.slope *= y / x;
    this.slope = parseFloat(this.slope.toFixed(FLOAT_PRECISION));
  }

  /*
    Get the intersect of two BaseLines
  */
  this.getIntersect = function(otherLine) {
    // x = (b1 - b2)/(m2 - m1)
    var intersectX = (this.intercept - otherLine.intercept)/(otherLine.slope - this.slope);

    // Line segment check
    if (!this.isXWithinBounds(intersectX) || !otherLine.isXWithinBounds(intersectX)) {
      return false;
    }

    return this.getPointOnLineAtX(intersectX);
  }

  /*
    Returns false if it's a line segment
  */
  this.getPointOnLineAtX = function(x) {
    // Line segment check
    if (!this.isXWithinBounds(x)) {
      return false;
    }

    // y = mx + b
    return new Point(x, this.slope * x + this.intercept);
  }
}

function InfiniteLine(slope, point) {
  LineBase.call(this, slope, point);
}

function LineSegment(start, end) {
  // Swap start and end if start is to the right of end
  if (start.x > end.x) {
    var temp = end;
    end = start;
    start = temp;
  }

  // Calculate the slope ourselves
  var slope = (end.y - start.y) / (end.x - start.x);

  LineBase.call(this, slope, start);

  /*
    Overriding LineBase's implementation
  */
  this.isXWithinBounds = function(x) {
    return (x >= start.x && x <= end.x);
  }

  /*
    Methods to get the initial arguments
    I prefer to have this than just to expose them on the object,
    because I want to avoid too many assumptions. At least in this
    case our code will error
  */
  this.getStartPoint = function() {
    return start;
  }
  this.getEndPoint = function() {
    return end;
  }
}
