/*
  Returns true if the W algorithm should be used:
  "w1" "w2"
  \/    /\
  \/ or /\
*/
function isWType(peak) {
  return (
    // "w1"
    peak.A.slope > 0 &&
    peak.B.slope < 0 &&
    peak.C.slope >= 0 &&
    peak.D.slope <= 0
  ) ||
  (
    // "w2"
    peak.A.slope <= 0 &&
    peak.B.slope >= 0 &&
    peak.C.slope < 0 &&
    peak.D.slope > 0
  );
}

function getWLabel(peak, text, font) {
  return new Label("W", peak.top.x, (peak.bottom.y + peak.top.y) / 2, "Roboto", 12);
}
