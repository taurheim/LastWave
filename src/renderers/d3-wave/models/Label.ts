/*
  A label contains all the information necessary to draw
  text on the SVG
*/
export default class Label {
  constructor(
    public text: string,
    public xPosition: number,
    public yPosition: number,
    public font: string,
    public fontSize: number,
  ) {
  }
}
