/* tslint:disable:max-classes-per-file */
declare module 'rickshaw' {
  export class RickshawPoint {
    public x: number;
    public y: number;
  }

  export class RickshawStackPoint {
    public x: number;
    public y: number;
    public y0: number;
  }

  export class RickshawStackData {
    public color: string;
    public name: string;
    public data: RickshawPoint[];
    public stack: RickshawStackPoint[];
  }

  export class Graph {
    public series: RickshawStackData[];
    public element: HTMLElement;
    constructor(obj: any)
    public render(): void;
  }

  export class RickshawRippleData {
    public name: string;
    public data: RickshawPoint[];
    public color: string;
  }
}
