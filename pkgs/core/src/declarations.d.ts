declare module '@yr/catmull-rom-spline' {
  const _: {
    points(points: number[][])
  }

  export = _
}

declare module 'svg-path-bounds' {
  function _(
    path: string
  ): [left: number, top: number, right: number, bottom: number]
  export = _
}

declare module 'normalize-svg-path' {
  function _(path: Array<[string, ...number[]]>): Array<[string, ...number[]]>
  export = _
}

declare module 'fast-shallow-equal' {
  export function equal(a: any, b: any): boolean
}

declare module 'point-at-length' {
  const _: (path: string | Array<[string, ...number[]]>) => {
    _path: [string, ...number[]][]
    length(): number
    at(point: number): [x: number, y: number]
  }

  export = _
}

declare module 'is-ios' {
  const _: boolean
  export = _
}

declare module 'fast-random' {
  const fastRandom: (seed: number) => {
    nextInt(): number
    nextFloat(): number
  }
  export = fastRandom
}

declare module 'abs-svg-path' {
  const _: (path: [string, ...number[]][]) => [string, ...number[]][]
  export = _
}

declare module '*.png' {
  const _: string
  export default _
}

declare module '*.frag' {
  const _: string
  export default _
}

declare module '*.glsl' {
  const _: string
  export default _
}

declare module '*?worker&inline' {
  const _: {
    new (): Worker
  }
  export default _
}
