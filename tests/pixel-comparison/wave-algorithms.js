/**
 * Shared wave algorithms for pixel comparison pages.
 * Vanilla JS port of the TypeScript core logic in src/core/.
 */

// ── Models ──────────────────────────────────────────────────────

function Point(x, y) { this.x = x; this.y = y; }
Point.prototype.scale = function(x, y) { this.x *= x; this.y *= y; };

function LineBase(slope, point) {
  this.point = point;
  this.slope = slope;
  this.intercept = point.y - slope * point.x;
}
LineBase.prototype.FLOAT_PRECISION = 4;
LineBase.prototype.isXWithinBounds = function() { return true; };
LineBase.prototype.scale = function(x, y) {
  this.intercept *= y;
  this.slope *= y / x;
  this.slope = parseFloat(this.slope.toFixed(this.FLOAT_PRECISION));
};
LineBase.prototype.getIntersect = function(other) {
  var ix = (this.intercept - other.intercept) / (other.slope - this.slope);
  if (!this.isXWithinBounds(ix) || !other.isXWithinBounds(ix)) return null;
  return this.getPointOnLineAtX(ix);
};
LineBase.prototype.getPointOnLineAtX = function(x) {
  if (!this.isXWithinBounds(x)) return null;
  return new Point(x, this.slope * x + this.intercept);
};

function InfiniteLine(slope, point) { LineBase.call(this, slope, point); }
InfiniteLine.prototype = Object.create(LineBase.prototype);

function LineSegment(start, end) {
  if (start.x > end.x) { var t = end; end = start; start = t; }
  var slope = (end.y - start.y) / (end.x - start.x);
  LineBase.call(this, slope, start);
  this.start = start;
  this.end = end;
}
LineSegment.prototype = Object.create(LineBase.prototype);
LineSegment.prototype.isXWithinBounds = function(x) {
  return x >= this.start.x && x <= this.end.x;
};

function Label(text, xPosition, yPosition, font, fontSize) {
  this.text = text; this.xPosition = xPosition; this.yPosition = yPosition;
  this.font = font; this.fontSize = fontSize;
}

function Peak(index, stack) {
  var LR = 0.1;
  this.top = new Point(stack[index].x, stack[index].y + stack[index].y0);
  this.bottom = new Point(stack[index].x, stack[index].y0);
  if (index === 0) {
    var fakeX = -1 * LR;
    var fakeY = this.bottom.y + (this.top.y - this.bottom.y) / 2;
    this.topLeft = new Point(fakeX, fakeY);
    this.bottomLeft = new Point(fakeX, fakeY);
  } else {
    this.topLeft = new Point(stack[index-1].x, stack[index-1].y + stack[index-1].y0);
    this.bottomLeft = new Point(stack[index-1].x, stack[index-1].y0);
  }
  if (index === stack.length - 1) {
    var fakeRX = this.top.x + LR;
    var fakeRY = this.bottom.y + (this.top.y - this.bottom.y) / 2;
    this.topRight = new Point(fakeRX, fakeRY);
    this.bottomRight = new Point(fakeRX, fakeRY);
  } else {
    this.topRight = new Point(stack[index+1].x, stack[index+1].y + stack[index+1].y0);
    this.bottomRight = new Point(stack[index+1].x, stack[index+1].y0);
  }
  this.A = new LineSegment(this.topLeft, this.top);
  this.B = new LineSegment(this.top, this.topRight);
  this.C = new LineSegment(this.bottomLeft, this.bottom);
  this.D = new LineSegment(this.bottom, this.bottomRight);
}
Peak.prototype.scale = function(x, y) {
  this.top.scale(x,y); this.bottom.scale(x,y);
  this.topLeft.scale(x,y); this.topRight.scale(x,y);
  this.bottomLeft.scale(x,y); this.bottomRight.scale(x,y);
  this.A.scale(x,y); this.B.scale(x,y); this.C.scale(x,y); this.D.scale(x,y);
};

// ── Text measurement (canvas-based, shared by both pages) ──────

function measureText(text, font, fontSize) {
  var canvas = document.createElement("canvas");
  var ctx = canvas.getContext("2d");
  ctx.font = fontSize + "px " + font;
  var w = ctx.measureText(text).width;
  var h = fontSize * 1.2;
  return { width: w, height: h, slope: h / w };
}

// ── findLabelIndices ────────────────────────────────────────────

function findLabelIndices(counts, segmentsBetweenLabels) {
  var possible = [];
  for (var i = 1; i < counts.length - 1; i++) possible.push(i);
  var result = [];
  while (possible.length) {
    var maxV = 0, maxI = 0;
    possible.forEach(function(idx) {
      if (counts[idx] > maxV) { maxV = counts[idx]; maxI = idx; }
    });
    if (maxV === 0) break;
    result.push(maxI);
    var from = maxI - segmentsBetweenLabels, to = maxI + segmentsBetweenLabels;
    for (var r = from; r < to; r++) {
      var pi = possible.indexOf(r);
      if (pi > -1) possible.splice(pi, 1);
    }
  }
  return result;
}

// ── Wave W ──────────────────────────────────────────────────────

function isWType(peak) {
  return (peak.A.slope <= 0 && peak.B.slope >= 0 && peak.C.slope < 0 && peak.D.slope > 0) ||
         (peak.A.slope > 0 && peak.B.slope < 0 && peak.C.slope > 0 && peak.D.slope < 0);
}

function getWLabel(peak, text, font) {
  var START = 5, INTERVAL = 2, SAFETY = 0.9;
  var fontSize = START, leftC, rightC, dims;
  var minH = measureText(text, font, fontSize).height;
  if ((peak.top.y - peak.bottom.y) < minH) return null;
  var isW1 = (peak.A.slope <= 0);
  var vpb = isW1 ? peak.top.y : peak.bottom.y;
  var hlb = isW1 ? peak.C : peak.A;
  var hrb = isW1 ? peak.D : peak.B;
  while (true) {
    dims = measureText(text, font, fontSize);
    var vib = isW1 ? vpb - dims.height : vpb + dims.height;
    if (vib > peak.top.y || vib < peak.bottom.y) break;
    var tl = new InfiniteLine(0, new Point(0, vib));
    leftC = tl.getIntersect(hlb);
    rightC = tl.getIntersect(hrb);
    if (!leftC) leftC = new Point(peak.topLeft.x, vib);
    if (!rightC) rightC = new Point(peak.topRight.x, vib);
    if (dims.width < (rightC.x - leftC.x)) fontSize += INTERVAL; else break;
  }
  fontSize *= SAFETY;
  dims = measureText(text, font, fontSize);
  var ly = isW1 ? peak.top.y - dims.height : peak.bottom.y;
  if (!leftC) return null;
  return new Label(text, leftC.x, ly, font, fontSize);
}

// ── Wave X ──────────────────────────────────────────────────────

function isXType(peak) {
  return (peak.A.slope <= 0 && peak.B.slope <= 0 && peak.C.slope <= 0 && peak.D.slope <= 0) ||
         (peak.A.slope >= 0 && peak.B.slope >= 0 && peak.C.slope >= 0 && peak.D.slope >= 0);
}

function getXLabel(peak, text, font) {
  var TEST_FS = 3000, MIN_SPACE = 1;
  var isX1 = peak.A.slope <= 0;
  var maxW = 0, maxWY, maxWLX;
  var bottomY = peak.bottom.y + 1, topY = peak.top.y - 1;
  if ((topY - bottomY) < MIN_SPACE) return null;
  var leftL = isX1 ? peak.C : peak.A;
  var rightL = isX1 ? peak.B : peak.D;
  for (var ty = bottomY; ty < topY; ty++) {
    var lx = (ty - leftL.intercept) / leftL.slope;
    var rx = (ty - rightL.intercept) / rightL.slope;
    if (lx < peak.topLeft.x || lx === Infinity) lx = peak.topLeft.x;
    if (rx > peak.topRight.x || rx === -Infinity) rx = peak.topRight.x;
    var w = rx - lx;
    if (w > maxW) { maxW = w; maxWY = ty; maxWLX = lx; }
  }
  var dims = measureText(text, font, TEST_FS);
  var htfr = dims.height / TEST_FS;
  var ts = dims.slope;
  if (!isX1) ts *= -1;
  if (!maxWLX || !maxWY) return null;
  var tc = new Point(maxWLX + maxW / 2, maxWY);
  var tLine = new InfiniteLine(ts, tc);
  var ltc = leftL.getIntersect(tLine);
  var rtc = rightL.getIntersect(tLine);
  if (!ltc) { ltc = isX1 ? peak.D.getIntersect(tLine) : peak.B.getIntersect(tLine); }
  if (!rtc) { rtc = isX1 ? peak.A.getIntersect(tLine) : peak.C.getIntersect(tLine); }
  if (!ltc) { ltc = tLine.getPointOnLineAtX(leftL.start.x); if (!ltc) return null; }
  if (!rtc) { rtc = tLine.getPointOnLineAtX(rightL.end.x); if (!rtc) return null; }
  var bh = Math.abs(ltc.y - rtc.y);
  var fs = Math.floor(bh / htfr);
  return new Label(text, ltc.x, Math.min(ltc.y, rtc.y), font, fs);
}

// ── Wave Y ──────────────────────────────────────────────────────

function isYType(peak) {
  return (peak.A.slope > 0 && peak.B.slope < 0 && peak.C.slope > 0 && peak.D.slope >= 0) ||
         (peak.A.slope > 0 && peak.B.slope < 0 && peak.C.slope <= 0 && peak.D.slope < 0) ||
         (peak.A.slope < 0 && peak.B.slope <= 0 && peak.C.slope < 0 && peak.D.slope > 0) ||
         (peak.A.slope >= 0 && peak.B.slope > 0 && peak.C.slope < 0 && peak.D.slope > 0);
}

var Y_TYPE = { Y1: 0, Y2: 1, Y3: 2, Y4: 3 };
var Y_CONFIG = {};
Y_CONFIG[Y_TYPE.Y1] = { startPoint: "bottom", slopeModifier: -1, opposite: "A", adjacent: "D", across: "B" };
Y_CONFIG[Y_TYPE.Y2] = { startPoint: "bottom", slopeModifier: 1, opposite: "B", adjacent: "C", across: "A" };
Y_CONFIG[Y_TYPE.Y3] = { startPoint: "top", slopeModifier: 1, opposite: "C", adjacent: "B", across: "D" };
Y_CONFIG[Y_TYPE.Y4] = { startPoint: "top", slopeModifier: -1, opposite: "D", adjacent: "A", across: "C" };

function yPerformIteration(sp, fs, opp, across, adj, pt) {
  var fl = new InfiniteLine(fs, sp);
  var ai = across.getIntersect(fl);
  if (ai) return adj.getPointOnLineAtX(ai.x);
  var cp = opp.getIntersect(fl);
  if (!cp) { cp = (pt === Y_TYPE.Y1 || pt === Y_TYPE.Y3) ? opp.start : opp.end; }
  var is = new Point(cp.x, sp.y);
  var il = new InfiniteLine(fs * -1, is);
  var adjI = adj.getIntersect(il);
  if (adjI) {
    var fixFL = new InfiniteLine(fs, adjI);
    var scAI = across.getIntersect(fixFL);
    if (scAI) return adj.getPointOnLineAtX(scAI.x);
    return adjI;
  }
  var invI = across.getIntersect(il);
  if (!invI) { invI = (pt === Y_TYPE.Y1 || pt === Y_TYPE.Y3) ? across.end : across.start; }
  var ns = adj.getPointOnLineAtX(invI.x);
  if (!ns) return null;
  var scl = new InfiniteLine(fs, ns);
  if (across.getIntersect(scl)) return sp;
  return ns;
}

function yCalcFontSize(sp, fs, opp, htfr) {
  var fl = new InfiniteLine(fs, sp);
  var ep = fl.getIntersect(opp);
  if (!ep) {
    ep = fl.getPointOnLineAtX(Math.min(opp.start.x, opp.end.y));
    if (!ep) return null;
  }
  return Math.floor(Math.abs(sp.y - ep.y) / htfr);
}

function getYLabel(peak, text, font) {
  var TEST_FS = 3000, CACHE = 2, MAX_ITER = 100;
  var pt;
  if (peak.A.slope < 0) pt = Y_TYPE.Y3;
  else if (peak.B.slope > 0) pt = Y_TYPE.Y4;
  else if (peak.C.slope > 0) pt = Y_TYPE.Y1;
  else pt = Y_TYPE.Y2;
  var cfg = Y_CONFIG[pt];
  var sp = peak[cfg.startPoint];
  var opp = peak[cfg.opposite], adj = peak[cfg.adjacent], across = peak[cfg.across];
  var dims = measureText(text, font, TEST_FS);
  var htfr = dims.height / TEST_FS;
  var fontSlope = dims.slope * cfg.slopeModifier;
  var cache = new Array(CACHE);
  var go = true, count = 0, fontSize = 0;
  while (go) {
    var nsp = yPerformIteration(sp, fontSlope, opp, across, adj, pt);
    if (!nsp) return null;
    var nfs = yCalcFontSize(nsp, fontSlope, opp, htfr);
    if (!nfs) return null;
    fontSize = nfs;
    cache.forEach(function(past) { if (past === fontSize) { go = false; nsp = sp; } });
    cache.shift(); cache.push(fontSize);
    if (++count > MAX_ITER) go = false;
    sp = nsp;
  }
  var fd = measureText(text, font, fontSize);
  if (pt === Y_TYPE.Y1 || pt === Y_TYPE.Y3) sp.x -= fd.width;
  if (pt === Y_TYPE.Y3 || pt === Y_TYPE.Y4) sp.y -= fd.height;
  return new Label(text, sp.x, sp.y, font, fontSize);
}

// ── Wave Z ──────────────────────────────────────────────────────

function isZType(peak) {
  return (peak.A.slope >= 0 && peak.B.slope <= 0 && peak.C.slope <= 0 && peak.D.slope >= 0) ||
         (peak.A.slope === 0 && peak.B.slope === 0 && peak.C.slope > 0 && peak.D.slope > 0);
}

function getZLabel(peak, text, font) {
  var TEST_FS = 3000;
  var rm = new Point(peak.topRight.x, (peak.topRight.y + peak.bottomRight.y) / 2);
  var lm = new Point(peak.topLeft.x, (peak.topLeft.y + peak.bottomLeft.y) / 2);
  var cp = new Point(peak.top.x, (lm.y + rm.y) / 2);
  var dims = measureText(text, font, TEST_FS);
  var fl = new InfiniteLine(dims.slope, cp);
  var bl = new InfiniteLine(dims.slope * -1, cp);
  var checks = ["A","B","C","D"];
  var minVD = Number.MAX_VALUE;
  checks.forEach(function(n) {
    var cl = peak[n];
    var al = (cl.slope < 0) ? fl : bl;
    var ci = cl.getIntersect(al);
    if (ci) {
      var vd = Math.abs(ci.y - cp.y);
      if (vd < minVD) minVD = vd;
    }
  });
  var bh = Math.floor(minVD * 2);
  var htfr = dims.height / TEST_FS;
  var fs = Math.floor(bh / htfr);
  var tx = cp.x - minVD / dims.slope;
  var ty = cp.y - bh / 2;
  return new Label(text, tx, ty, font, fs);
}

// ── Main label-drawing entry point ──────────────────────────────

/**
 * Draw labels on an SVG using Rickshaw-style stack data.
 * @param {d3 selection} svg - The SVG selection
 * @param {Array} stackData - Array of { name, stack: [{x, y, y0}], data: [{x, y}] }
 * @param {number} graphWidth
 * @param {number} graphHeight
 * @param {string} fontFamily
 * @param {string} fontColor
 * @param {number} minFontSize
 */
function addLabelsOld(svg, stackData, graphWidth, graphHeight, fontFamily, fontColor, minFontSize) {
  // Compute scaling values (same as old code)
  var maxy0 = 0;
  var lastRipple = stackData[stackData.length - 1];
  lastRipple.stack.forEach(function(p) {
    var h = p.y + p.y0;
    if (h > maxy0) maxy0 = h;
  });
  var sx = graphWidth / (stackData[0].stack.length - 1);
  var sy = graphHeight / maxy0;

  stackData.forEach(function(ripple) {
    var counts = ripple.data.map(function(d) { return d.y; });
    var labelIndices = findLabelIndices(counts, 3);
    labelIndices.forEach(function(idx) {
      var peak = new Peak(idx, ripple.stack);
      peak.scale(sx, sy);
      var label = classifyAndLabel(peak, ripple.name, fontFamily);
      if (label && label.fontSize >= (minFontSize || 8)) {
        svg.append("text")
          .text(label.text)
          .attr("x", label.xPosition)
          .attr("y", graphHeight - label.yPosition)
          .attr("font-size", label.fontSize)
          .attr("font-family", fontFamily)
          .attr("fill", fontColor);
      }
    });
  });
}

/**
 * Draw labels using D3 v7 stack data (pre-scaled pixel coordinates).
 * Converts to the same inverted coordinate system the wave algorithms expect.
 */
function addLabelsNew(svg, stackedData, seriesData, xScale, yScale, graphWidth, graphHeight, fontFamily, fontColor, minFontSize) {
  var keys = seriesData.map(function(s) { return s.title; });

  stackedData.forEach(function(layer, layerIndex) {
    var counts = seriesData[layerIndex].counts;
    var labelIndices = findLabelIndices(counts, 3);

    // Build StackPoints in inverted coordinate space (y=0 at bottom, y=height at top)
    // to match the old Rickshaw coordinate system
    var stackPoints = layer.map(function(d, i) {
      // d[0] = lower data bound, d[1] = upper data bound
      // In SVG: yScale(d[0]) = bottom (high SVG y), yScale(d[1]) = top (low SVG y)
      // In inverted: bottom = height - yScale(d[0]), top = height - yScale(d[1])
      var invertedBottom = graphHeight - yScale(d[0]);
      var invertedTop = graphHeight - yScale(d[1]);
      return {
        x: xScale(i),
        y: invertedTop - invertedBottom,  // height of band
        y0: invertedBottom                // baseline (inverted)
      };
    });

    labelIndices.forEach(function(idx) {
      if (idx <= 0 || idx >= stackPoints.length - 1) return;
      var peak = new Peak(idx, stackPoints);
      // No need to scale — already in pixel coordinates
      var label = classifyAndLabel(peak, keys[layerIndex], fontFamily);
      if (label && label.fontSize >= (minFontSize || 8)) {
        svg.append("text")
          .text(label.text)
          .attr("x", label.xPosition)
          .attr("y", graphHeight - label.yPosition)
          .attr("font-size", label.fontSize)
          .attr("font-family", fontFamily)
          .attr("fill", fontColor);
      }
    });
  });
}

function classifyAndLabel(peak, text, font) {
  if (isWType(peak)) return getWLabel(peak, text, font);
  if (isZType(peak)) return getZLabel(peak, text, font);
  if (isYType(peak)) return getYLabel(peak, text, font);
  if (isXType(peak)) return getXLabel(peak, text, font);
  return null;
}
