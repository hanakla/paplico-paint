import { mapEntries } from '@paplico/shared-lib'
import { IGeometry } from '../interfaces/IGeometry'
import { Program } from '../Program'

export type BufferAttributes = Record<
  string,
  {
    itemSize: number
    buffer: WebGLBuffer
    bufferSubData: boolean
    rawBuffer: any
    stride: number
    offset: number
  }
>

export class Mesh {
  constructor(
    public geometry: IGeometry,
    public program: Program,
  ) {}

  public render(gl: WebGL2RenderingContext) {
    const program = this.program.compile(gl)
    const buffer = this.geometry.compile(gl)

    gl.useProgram(program)

    const buffers = Object.fromEntries(
      mapEntries(this.geometry.getAllAttributes(), ([name, data]) => {
        const buffer = gl.createBuffer()!
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer)

        // if (data.bufferSubData) {
        //   gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.buffer)
        // } else {
        gl.bufferData(gl.ARRAY_BUFFER, data.buffer, gl.STATIC_DRAW)
        // }

        gl.bindBuffer(gl.ARRAY_BUFFER, null)

        return [
          name,
          {
            itemSize: data.itemSize,
            buffer,
            bufferSubData: data.bufferSubData,
            rawBuffer: data.buffer,
            stride: data.stride,
            offset: data.offset,
          } satisfies BufferAttributes[string],
        ]
      }),
    )

    this.program.attachAttributes(gl, program, {
      ...buffers,
    })

    this.program.attachUniforms(gl, program)

    if (buffer.indices) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer.indices)

      gl.drawElements(
        gl.TRIANGLES,
        this.geometry.vertexCount,
        gl.UNSIGNED_SHORT,
        0,
      )
    } else {
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
  }
}
