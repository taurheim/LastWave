// TODO this would probably be a lot better if we just subclassed it
export default class Option {
  // Set in getOptions()
  // TODO this entire part where we pass around who owns the option is actually garbage
  public owner: string = "";
  constructor(
    public title: string, // What is shown to the user
    public alias: string, // What is used on the back end
    public type: string,
    public defaultValue?: string,
    public options?: string[],
    public mainView?: boolean,
    public connectedOptions?: Option[],
  ) {
  }
}
