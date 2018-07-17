import Option from './Option';
import SeriesData from '@/models/SeriesData';
import LoadingStage from '@/models/LoadingStage';

export default interface Renderer {
  title: string;
  getOptions(): Option[],
  getLoadingStages(options: any): LoadingStage[],
  renderVisualization(data: SeriesData[], options: any): void,
}
