import Option from '../Option';

export default class BooleanOption extends Option {
  constructor(
    public title: string,
    public alias: string,
    public isImportant: boolean,
    public defaultValue?: boolean,
  ) {
    super(title, alias, isImportant);
  }
}
