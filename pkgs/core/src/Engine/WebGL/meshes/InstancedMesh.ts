import { mapEntries } from '@paplico/shared-lib'
import { IGeometry } from '../interfaces/IGeometry'
import { IMesh } from '../interfaces/IMesh'
import { Program } from '../Program'

export class InstancedMesh implements IMesh {
  public constructor(
    public geometry: IGeometry,
    public program: Program,
    public count: number,
  ) {}

  public render(gl: WebGL2RenderingContext) {
    const program = this.program.compile(gl)
    const buffer = this.geometry.compile(gl)

    gl.useProgram(program)

    const buffers = Object.fromEntries(
      mapEntries(this.geometry.getAllAttributes(), ([name, data]) => {
        const buffer = gl.createBuffer()!
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
        gl.bufferData(gl.ARRAY_BUFFER, data.buffer, gl.STATIC_DRAW)
        gl.bindBuffer(gl.ARRAY_BUFFER, null)
        return [
          name,
          { itemSize: data.itemSize, buffer, rawBuffer: data.buffer },
        ]
      }),
    )

    this.program.attachAttributes(gl, program, {
      aPosition: {
        itemSize: 3,
        buffer: buffer.vertices,
        rawBuffer: this.geometry.rawBuffer,
      },
      ...buffers,
    })

    this.program.attachUniforms(gl, program)

    if (buffer.indices) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer.indices)

      gl.drawElementsInstanced(
        gl.TRIANGLES,
        this.geometry.vertexCount,
        gl.UNSIGNED_SHORT,
        0,
        this.count,
      )
    } else {
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.count)
    }
  }
}
