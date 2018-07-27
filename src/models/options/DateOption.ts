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

  public convertToOptionType(stringValue: string): any {
    return new Date(parseInt(stringValue, 10));
  }
}
