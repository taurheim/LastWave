/*
  Returns true if the X algorithm should be used:
  "x1" "x2"
   \\  //
   \\  //
*/
function isXType(peak) {
  return (
    // "x1"
    peak.A.slope <= 0 &&
    peak.B.slope < 0 &&
    peak.C.slope < 0 &&
    peak.D.slope <= 0
  ) ||
  (
    // "x2"
    peak.A.slope > 0 &&
    peak.B.slope >= 0 &&
    peak.C.slope >= 0 &&
    peak.D.slope > 0
  )
}

function getXLabel(peak, text, font) {
  return new Label("X", peak.top.x, (peak.bottom.y + peak.top.y) / 2, "Roboto", 12);
}
