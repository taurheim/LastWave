import Option from 'src/models/Option';
import LoadingStage from '@/models/LoadingStage';
import SeriesData from '@/models/SeriesData';

export default interface DataSource {
    title: string;
    getOptions(): Option[];
    getLoadingStages(options: any): LoadingStage[];
    loadData(options: any): Promise<SeriesData[]>;
}
