import MODULE from './MODULE';

export default class Option {
  public module: MODULE = MODULE.NONE;

  constructor(
  // This is what the user sees
  public title: string,

  // This is what the data source, renderer, or action sees
  public alias: string,

  // This controls whether it should be prioritized as an option to the user
  public isImportant: boolean,
  ) {
  }

  // Override this
  public convertToOptionType(stringValue: string): any {
    return stringValue;
  }
}
