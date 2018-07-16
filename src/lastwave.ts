import Cloudinary from '@/actions/cloudinary';
import LastFm from '@/datasources/lastfm';
import WaveGraph from '@/renderers/d3-wave';
import DataSource from '@/models/DataSource';
import Renderer from '@/models/Renderer';
import Option from '@/models/Option';
import SeriesData from '@/models/SeriesData';
import WaveAction from '@/models/WaveAction';

export default class LastWaveEngine {
	CreateWave(dataSource: DataSource, renderer: Renderer, dataSourceOptions: any, rendererOptions: any) {
		console.log("Creating Wave");
		console.log("Perform validation");

		dataSource.loadData(dataSourceOptions, function(err: any, musicData: SeriesData[]) {
			renderer.renderVisualization(musicData, rendererOptions);
		});
	}

	ShowActions() {
		console.log("Determine which actions can be taken and display them");
		$("body").append("<button onclick=PerformAction()>Action</button>");
	}

	PerformAction() {
		console.log("Perform action");
	}
}