import Option from './Option';

export default interface Renderer {
  title: string;
  getOptions(): Option[],
}
