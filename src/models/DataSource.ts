import Option from 'src/models/Option';
import LoadingStage from '@/models/LoadingStage';

export default interface DataSource {
    title: string,
    getOptions(): Option[],
    getLoadingStages(options: any): LoadingStage[],
    loadData(options: any, callback: any): void,
}
