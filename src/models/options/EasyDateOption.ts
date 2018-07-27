import Option from '../Option';
import DateOption from './DateOption';
import EasyDates from '@/config/easyDates.json';

export default class EasyDateOption extends Option {
  constructor(
    public title: string,
    public alias: string,
    public isImportant: boolean,
    public defaultValue?: string,
    public linkedDateOptions?: DateOption[],
  ) {
    super(title, alias, isImportant);
    if (defaultValue && !EasyDates[defaultValue]) {
      throw new Error('defaultValue for EasyDateOption must be in the easyDates.json file');
    }
  }
}
