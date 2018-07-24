import MODULE from './MODULE';

// TODO this would probably be a lot better if we just subclassed it
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
}
