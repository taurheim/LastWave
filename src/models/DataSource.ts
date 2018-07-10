import Option from 'src/models/Option';

export default interface DataSource {
    title: string,
    getOptions(): Option[],
    loadData(options: any, callback: any): void,
}
