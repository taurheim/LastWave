import Option from 'src/models/Option';

export default interface DataSource {
    getOptions(): [Option],
    loadData(): void,
}
