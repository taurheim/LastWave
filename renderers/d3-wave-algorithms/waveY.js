/*
  Returns true if the Y algorithm should be used:
  "y1" "y2" "y3" "y4"
  /\    /\  \\   //
  // or \\  \/   \/
*/
function isYType(peak) {
  return (
    // y1
    peak.A.slope > 0 &&
    peak.B.slope < 0 &&
    peak.C.slope >= 0 &&
    peak.D.slope > 0
  ) ||
  (
    // y2
    peak.A.slope > 0 &&
    peak.B.slope < 0 &&
    peak.C.slope < 0 &&
    peak.D.slope <= 0
  ) ||
  (
    // y3
    peak.A.slope <= 0 &&
    peak.B.slope < 0 &&
    peak.C.slope < 0 &&
    peak.D.slope > 0
  ) ||
  (
    // y4
    peak.A.slope > 0 &&
    peak.B.slope >= 0 &&
    peak.C.slope < 0 &&
    peak.D.slope > 0
  );
}

function getYLabel(peak, text, font) {
  if(text == "GoldLink") {
    console.log("Debugbrk");
  }
  return new Label(text, peak.top.x, (peak.bottom.y), "Roboto", 12);
}
