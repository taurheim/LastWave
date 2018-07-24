import Option from '../Option';

export default class DateOption extends Option {
  constructor(
    public title: string,
    public alias: string,
    public isImportant: boolean,
    public defaultValue?: Date,
  ) {
    super(title, alias, isImportant);
  }
}
