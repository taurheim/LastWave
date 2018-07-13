import Option from './Option';
import SeriesData from '@/models/SeriesData';

export default interface Renderer {
  title: string;
  getOptions(): Option[],
  renderVisualization(data: SeriesData[], options: any): void,
}
