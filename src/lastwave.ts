import DataSource from '@/models/DataSource';
import Renderer from '@/models/Renderer';
import SeriesData from '@/models/SeriesData';
import jQuery from 'jquery';
import store from '@/store';

export default class LastWaveEngine {
	// Loading times
	DATA_SOURCE_TO_RENDERER_RATIO: number = 0.8;

	CreateWave(dataSource: DataSource, renderer: Renderer, dataSourceOptions: any, rendererOptions: any) {
		console.log("Creating Wave");
		console.log("Perform validation");

		this.setupLoadingStages(dataSource, renderer, dataSourceOptions, rendererOptions);

		dataSource.loadData(dataSourceOptions, function(err: any, musicData: SeriesData[]) {
			if (err) {
				console.log("Error encountered: " + err);
			}
			console.log("Rendering visualization...");
			renderer.renderVisualization(musicData, rendererOptions);
			console.log("Visualization finished rendering.");
		});
	}

	setupLoadingStages(dataSource: DataSource, renderer: Renderer, dataSourceOptions: any, rendererOptions: any) {
		let dataSourceStages = dataSource.getLoadingStages(dataSourceOptions);
		let rendererStages = renderer.getLoadingStages(rendererOptions);

		dataSourceStages.forEach(stage => {
			stage.stageWeight *= this.DATA_SOURCE_TO_RENDERER_RATIO;
		});

		rendererStages.forEach(stage => {
			stage.stageWeight *= 1 - this.DATA_SOURCE_TO_RENDERER_RATIO;
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