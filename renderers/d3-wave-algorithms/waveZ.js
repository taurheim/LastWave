/*
  Returns true if the Z algorithm should be used:
  /\
  \/
*/
function isZType(peak) {
  return (
    peak.A.slope > 0 &&
    peak.B.slope < 0 &&
    peak.C.slope < 0 &&
    peak.D.slope > 0
  );
}

function getZLabel(peak, text, font) {
  return new Label("Z", peak.top.x, (peak.bottom.y + peak.top.y) / 2, "Roboto", 12);
}
