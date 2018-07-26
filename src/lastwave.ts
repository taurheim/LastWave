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
    console.log('Creating Wave');
    // TODO validate options

    this.setupLoadingStages(dataSource, renderer, dataSourceOptions, rendererOptions);

    const musicData = await dataSource.loadData(dataSourceOptions);
    console.log('Rendering visualization...');
    await renderer.renderVisualization(musicData, rendererOptions);
    console.log('Visualization finished rendering.');
  }

  setupLoadingStages(dataSource: DataSource, renderer: Renderer, dataSourceOptions: any, rendererOptions: any) {
    let dataSourceStages = dataSource.getLoadingStages(dataSourceOptions);
    let rendererStages = renderer.getLoadingStages(rendererOptions);

    dataSourceStages.forEach((stage) => {
      stage.stageWeight *= this.DATA_SOURCE_TO_RENDERER_RATIO;
    });

    rendererStages.forEach(stage => {
      // Doing this in a stupid way so we prevent weird floating point things
      stage.stageWeight -= (stage.stageWeight * this.DATA_SOURCE_TO_RENDERER_RATIO);
    });

    const allStages = dataSourceStages.concat(rendererStages);

    store.commit("setStages", allStages);
  }

  ShowActions() {
    console.log("Determine which actions can be taken and display them");
    jQuery("body").append("<button onclick=PerformAction()>Action</button>");
  }

  PerformAction() {
    console.log("Perform action");
  }
}