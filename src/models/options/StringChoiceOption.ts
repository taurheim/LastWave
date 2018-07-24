import Option from '../Option';

export default class StringChoiceOption extends Option {
  constructor(
    public title: string,
    public alias: string,
    public isImportant: boolean,
    public defaultValue: string,
    public choices: string[],
  ) {
    super(title, alias, isImportant);
  }
}
