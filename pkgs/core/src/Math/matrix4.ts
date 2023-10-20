import { type mat4 } from 'gl-matrix'

export type Vector3Tuple = [x: number, y: number, z: number]

// from: https://github.com/toji/gl-matrix/blob/master/src/mat4.js
export class Matrix4 {
  // prettier-ignore
  protected matrix: mat4 = [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ]

  public translate(...vector: Vector3Tuple): this {
    const out = this.matrix,
      a = this.matrix.slice(),
      [x, y, z] = vector

    let a00, a01, a02, a03
    let a10, a11, a12, a13
    let a20, a21, a22, a23

    if (a === out) {
      out[12] = a[0] * x + a[4] * y + a[8] * z + a[12]
      out[13] = a[1] * x + a[5] * y + a[9] * z + a[13]
      out[14] = a[2] * x + a[6] * y + a[10] * z + a[14]
      out[15] = a[3] * x + a[7] * y + a[11] * z + a[15]
    } else {
      a00 = a[0]
      a01 = a[1]
      a02 = a[2]
      a03 = a[3]
      a10 = a[4]
      a11 = a[5]
      a12 = a[6]
      a13 = a[7]
      a20 = a[8]
      a21 = a[9]
      a22 = a[10]
      a23 = a[11]

      out[0] = a00
      out[1] = a01
      out[2] = a02
      out[3] = a03
      out[4] = a10
      out[5] = a11
      out[6] = a12
      out[7] = a13
      out[8] = a20
      out[9] = a21
      out[10] = a22
      out[11] = a23

      out[12] = a00 * x + a10 * y + a20 * z + a[12]
      out[13] = a01 * x + a11 * y + a21 * z + a[13]
      out[14] = a02 * x + a12 * y + a22 * z + a[14]
      out[15] = a03 * x + a13 * y + a23 * z + a[15]
    }

    return this
  }

  /**
   * Scales the mat4 by the dimensions in the given vec3 not using vectorization
   **/
  public scale(v: Vector3Tuple) {
    const out = this.matrix
    const a = this.matrix.slice()
    const [x, y, z] = v

    out[0] = a[0] * x
    out[1] = a[1] * x
    out[2] = a[2] * x
    out[3] = a[3] * x
    out[4] = a[4] * y
    out[5] = a[5] * y
    out[6] = a[6] * y
    out[7] = a[7] * y
    out[8] = a[8] * z
    out[9] = a[9] * z
    out[10] = a[10] * z
    out[11] = a[11] * z
    out[12] = a[12]
    out[13] = a[13]
    out[14] = a[14]
    out[15] = a[15]

    return this
  }

  public rotateZ(rad: number): this {
    const out = this.matrix,
      a = this.matrix.slice()

    let s = Math.sin(rad)
    let c = Math.cos(rad)
    let a00 = a[0]
    let a01 = a[1]
    let a02 = a[2]
    let a03 = a[3]
    let a10 = a[4]
    let a11 = a[5]
    let a12 = a[6]
    let a13 = a[7]

    if (a !== out) {
      // If the source and destination differ, copy the unchanged last row
      out[8] = a[8]
      out[9] = a[9]
      out[10] = a[10]
      out[11] = a[11]
      out[12] = a[12]
      out[13] = a[13]
      out[14] = a[14]
      out[15] = a[15]
    }

    // Perform axis-specific matrix multiplication
    out[0] = a00 * c + a10 * s
    out[1] = a01 * c + a11 * s
    out[2] = a02 * c + a12 * s
    out[3] = a03 * c + a13 * s
    out[4] = a10 * c - a00 * s
    out[5] = a11 * c - a01 * s
    out[6] = a12 * c - a02 * s
    out[7] = a13 * c - a03 * s

    return this
  }

  public toArray() {
    return this.matrix.slice(0)
  }
}
