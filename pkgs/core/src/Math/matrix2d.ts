export type Vector2Tuple = [x: number, y: number]

// prettier-ignore
export type Matrix2DArray = [
  number, number,
  number, number,
  number, number,
]

// from: https://github.com/toji/gl-matrix/blob/master/src/mat2d.js
export class Matrix2D {
  // prettier-ignore
  protected matrix: Matrix2DArray = [
    1, 0,
    0, 1,
    0, 0,
  ]

  // prettier-ignore
  public get a() { return this.matrix[0] }
  // prettier-ignore
  public get b() { return this.matrix[1] }
  // prettier-ignore
  public get c() { return this.matrix[2] }
  // prettier-ignore
  public get d() { return this.matrix[3] }
  // prettier-ignore
  public get e() { return this.matrix[4] }
  // prettier-ignore
  public get f() { return this.matrix[5] }

  public translate(...vector: Vector2Tuple): this {
    const out = this.matrix,
      a = this.matrix.slice()

    const [a0, a1, a2, a3, a4, a5] = a
    const [v0, v1] = vector

    out[0] = a0
    out[1] = a1
    out[2] = a2
    out[3] = a3
    out[4] = a0 * v0 + a2 * v1 + a4
    out[5] = a1 * v0 + a3 * v1 + a5

    return this
  }

  /**
   * Scales the mat4 by the dimensions in the given vec3 not using vectorization
   **/
  public scale(v: Vector2Tuple) {
    const out = this.matrix
    const a = this.matrix.slice()

    const [a0, a1, a2, a3, a4, a5] = a
    const [v0, v1] = v

    out[0] = a0 * v0
    out[1] = a1 * v0
    out[2] = a2 * v1
    out[3] = a3 * v1
    out[4] = a4
    out[5] = a5

    return this
  }

  public rotateZ(rad: number): this {
    const out = this.matrix,
      a = this.matrix.slice()

    const [a0, a1, a2, a3, a4, a5] = a
    let s = Math.sin(rad)
    let c = Math.cos(rad)

    out[0] = a0 * c + a2 * s
    out[1] = a1 * c + a3 * s
    out[2] = a0 * -s + a2 * c
    out[3] = a1 * -s + a3 * c
    out[4] = a4
    out[5] = a5

    return this
  }

  public multiply(b: Matrix2D): this {
    const out = this.matrix,
      a = this.matrix.slice(),
      _b = b.toArray()

    let [a0, a1, a2, a3, a4, a5] = a
    let [b0, b1, b2, b3, b4, b5] = _b

    out[0] = a0 * b0 + a2 * b1
    out[1] = a1 * b0 + a3 * b1
    out[2] = a0 * b2 + a2 * b3
    out[3] = a1 * b2 + a3 * b3
    out[4] = a0 * b4 + a2 * b5 + a4
    out[5] = a1 * b4 + a3 * b5 + a5

    return this
  }

  public invert() {
    const out = this.matrix,
      a = this.matrix.slice()

    const [aa, ab, ac, ad, atx, aty] = a
    let det = aa * ad - ab * ac

    if (!det) {
      return null
    }

    det = 1.0 / det

    out[0] = ad * det
    out[1] = -ab * det
    out[2] = -ac * det
    out[3] = aa * det
    out[4] = (ac * aty - ad * atx) * det
    out[5] = (ab * atx - aa * aty) * det

    return this
  }

  public transformPoint([x, y]: Vector2Tuple) {
    const [a, b, c, d, e, f] = this.matrix

    const nx = a * x + c * y + e
    const ny = b * x + d * y + f

    return { x: nx, y: ny }
  }

  public toArray(): Matrix2DArray {
    return this.matrix.slice(0) as Matrix2DArray
  }
}
