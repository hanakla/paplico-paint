declare module '@yr/catmull-rom-spline' {
  declare const _: {
    points(points: number[][])
  }

  export = _
}

declare module 'svg-path-bounds' {
  declare function _(
    path: string
  ): [left: number, top: number, right: number, bottom: number]
  export = _
}

declare module 'point-at-length' {
  declare const _: (path: string) => {
    length(): number
    at(point: number): [x: number, y: number]
  }

  export = _
}
