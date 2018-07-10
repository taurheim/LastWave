import Option from 'src/models/Option';
import SeriesData from 'src/models/SeriesData';

export default interface Action {
    getOptions(): [Option],
    performAction(data: SeriesData): void,
}
