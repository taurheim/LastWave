import Option from '../Option';
import Image from './Image';

export default class ImageChoiceOption extends Option {
  constructor(
    public title: string,
    public alias: string,
    public isImportant: boolean,
    public defaultImageAlias: string,
    public choices: Image[],
  ) {
    super(title, alias, isImportant);
  }
}
