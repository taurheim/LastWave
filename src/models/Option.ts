export default class Option {
  constructor(
    public title: string,
    public type: string,
    public defaultValue?: string,
    public options?: string[],
  ) {
  }
}
