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

declare module 'point-at-length' {
  const _: (path: string) => {
    length(): number
    at(point: number): [x: number, y: number]
  }

  export = _
}

declare module 'fast-random' {
  const fastRandom: (seed: number) => {
    nextInt(): number
    nextFloat(): number
  }
  export = fastRandom
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
