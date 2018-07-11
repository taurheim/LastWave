declare module 'rickshaw' {
  export class RickshawPoint {
    x: number
    y: number
  }

  export class RickshawStackPoint {
    x: number
    y: number
    y0: number
  }

  export class RickshawStackData {
    color: string
    name: string
    data: RickshawPoint[]
    stack: RickshawStackPoint[]
  }

  export class Graph {
    constructor(obj: any)
    render(): void
    series: RickshawStackData[]
  }

  export class RickshawRippleData {
    name: string;
    data: RickshawPoint[];
    color: string;
  }
}
