import Option from '../Option';
import Image from './Image';

export default class ImageChoiceOption extends Option {
  constructor(
    public title: string,
    public alias: string,
    public isImportant: boolean,
    // Alias of the default image
    public defaultValue: string,
    public choices: Image[],
  ) {
    super(title, alias, isImportant);
  }
}
