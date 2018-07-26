import Option from './Option';
import SeriesData from '@/models/SeriesData';
import LoadingStage from '@/models/LoadingStage';
import Bluebird from 'bluebird';

export default interface Renderer {
  title: string;
  getOptions(): Option[];
  getLoadingStages(options: any): LoadingStage[];
  renderVisualization(data: SeriesData[], options: any): Bluebird<void>;
}
