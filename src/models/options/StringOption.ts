import Option from '../Option';

export default class ImageChoice extends Option {
  constructor(
    public title: string,
    public alias: string,
    public isImportant: boolean,
    public defaultValue?: string,
  ) {
    super(title, alias, isImportant);
  }
}
