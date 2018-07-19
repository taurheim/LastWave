import Option from 'src/models/Option';
import SeriesData from 'src/models/SeriesData';

export default interface WaveAction {
    getOptions(): Option[],
    prepareAction(data: SeriesData): void,
    performAction(data: SeriesData): void,
}
