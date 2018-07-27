import DataSource from '@/models/DataSource';
import Renderer from '@/models/Renderer';
import SeriesData from '@/models/SeriesData';
import jQuery from 'jquery';
import store from '@/store';
import WaveAction from '@/models/WaveAction';

export default class LastWaveEngine {
  // Loading times
  private DATA_SOURCE_TO_RENDERER_RATIO: number = 0.8;
  private LOADING_STAGE_PRECISION: number = 2;

  public async CreateWave(
    dataSource: DataSource,
    renderer: Renderer,
    dataSourceOptions: any,
    rendererOptions: any,
  ): Promise<void> {
    store.commit('log', 'Loading Data...');
    // TODO validate options

    this.setupLoadingStages(dataSource, renderer, dataSourceOptions, rendererOptions);

    const musicData = await dataSource.loadData(dataSourceOptions);
    store.commit('log', 'Loaded data, rendering visualization...');
    await renderer.renderVisualization(musicData, rendererOptions);
    store.commit('log', 'Rendered visualization.');
  }

  private setupLoadingStages(dataSource: DataSource, renderer: Renderer, dataSourceOptions: any, rendererOptions: any) {
    const dataSourceStages = dataSource.getLoadingStages(dataSourceOptions);
    const rendererStages = renderer.getLoadingStages(rendererOptions);

    dataSourceStages.forEach((stage) => {
      stage.stageWeight *= this.DATA_SOURCE_TO_RENDERER_RATIO;
    });

    rendererStages.forEach((stage) => {
      // Doing this in a stupid way so we prevent weird floating point things
      stage.stageWeight -= (stage.stageWeight * this.DATA_SOURCE_TO_RENDERER_RATIO);
    });

    const allStages = dataSourceStages.concat(rendererStages);

    store.commit('setStages', allStages);
  }
}
