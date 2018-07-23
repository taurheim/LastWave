import DataSource from '@/models/DataSource';
import Renderer from '@/models/Renderer';
import SeriesData from '@/models/SeriesData';
import jQuery from 'jquery';
import store from '@/store';
import WaveAction from '@/models/WaveAction';

export default class LastWaveEngine {
  // Loading times
  DATA_SOURCE_TO_RENDERER_RATIO: number = 0.8;
  LOADING_STAGE_PRECISION: number = 2;

  CreateWave(dataSource: DataSource, renderer: Renderer, dataSourceOptions: any, rendererOptions: any): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log("Creating Wave");
      console.log("Perform validation");

      this.setupLoadingStages(dataSource, renderer, dataSourceOptions, rendererOptions);

      dataSource.loadData(dataSourceOptions, function(err: any, musicData: SeriesData[]) {
        if (err) {
          console.log("Error encountered: " + err);
        }
        console.log("Rendering visualization...");

        renderer.renderVisualization(musicData, rendererOptions).then(() => {
          console.log("Visualization finished rendering.");
          resolve();
        });
      });
    });
  }

  setupLoadingStages(dataSource: DataSource, renderer: Renderer, dataSourceOptions: any, rendererOptions: any) {
    let dataSourceStages = dataSource.getLoadingStages(dataSourceOptions);
    let rendererStages = renderer.getLoadingStages(rendererOptions);

    dataSourceStages.forEach((stage) => {
      stage.stageWeight *= this.DATA_SOURCE_TO_RENDERER_RATIO;
    });

    rendererStages.forEach(stage => {
      // Doing this in a stupid way so we prevent weird floating point things
      stage.stageWeight *= stage.stageWeight - (stage.stageWeight * this.DATA_SOURCE_TO_RENDERER_RATIO);
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