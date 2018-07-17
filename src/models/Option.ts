export default class Option {
  constructor(
    public title: string, // What is shown to the user
    public alias: string, // What is used on the back end
    public type: string,
    public defaultValue?: string,
    public options?: string[],
  ) {
  }
}
