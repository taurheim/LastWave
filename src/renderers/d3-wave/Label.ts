/*
  A label contains all the information necessary to draw
  text on the SVG
*/
function Label(text, xPosition, yPosition, font, fontSize) {
  this.text = text;
  this.x = xPosition;
  this.y = yPosition;
  this.font = font;
  this.fontSize = fontSize
  return this;
}
