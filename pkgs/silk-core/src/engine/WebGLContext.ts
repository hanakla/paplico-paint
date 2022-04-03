import { assign } from '../utils'

type Uniform =
  | {
      type:
        | `${1 | 2 | 3 | 4}${'i' | 'ui' | 'f' | 'iv' | 'fv' | 'uiv'}`
        | 'matrix2fv'
        | 'matrix3x2fv'
        | 'matrix4x2fv'
        | 'matrix2x3fv'
        | 'matrix3fv'
        | 'matrix4x3fv'
        | 'matrix2x4fv'
        | 'matrix3x4fv'
        | 'matrix4fv'
      value: ReadonlyArray<number>
    }
  | {
      type: 'texture2d'
      value: TexImageSource | TextureResource
    }

class TextureResource {
  constructor(public tex: WebGLTexture) {}
}

// const DEFAULT_FRAGMENT_SHADER = `
//   precision mediump high;

//   uniform sampler2D source;
//   varying vec2 vTexCoord;

//   void main(void) {
//     gl_FragColor = texture2D(source, vTexCoord);
//   }
// `

const DEFAULT_VERTEX_SHADER = `
precision highp float;

attribute vec2 position;
attribute vec2 coord;
varying vec2 vTexCoord;

void main(void) {
    vTexCoord = coord;
    gl_Position = vec4(position, 0.0, 1.0);
}
`

const handleShadeCompilationError = (
  gl: WebGLRenderingContext,
  shader: WebGLShader
) => {
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader)
    throw new Error(`Failed to compile shader: \n${log}`)
  }
}

export declare namespace WebGLContext {
  export type ProgramSet = {
    vs: WebGLShader
    fs: WebGLShader
    program: WebGLProgram
  }
}

export default class WebGLContext {
  private gl: WebGLRenderingContext
  private vertexBuffer: WebGLBuffer
  private tex2DBuffer: WebGLBuffer

  public constructor(private width: number, private height: number) {
    // OffscreenCanvas not updated frame (bug?) so using HTMLCanvasElement
    this.gl = assign(document.createElement('canvas'), {
      width,
      height,
    }).getContext('webgl')!

    this.gl.viewport(0, 0, width, height)

    this.vertexBuffer = this.gl.createBuffer()!
    this.tex2DBuffer = this.gl.createBuffer()!
  }

  public setSize(width: number, height: number) {
    assign(this.gl.canvas, { width, height })
    this.gl.viewport(0, 0, width, height)
  }

  public createProgram(
    fragmentShaderSource: string,
    vertexShaderSource: string = DEFAULT_VERTEX_SHADER
  ): WebGLContext.ProgramSet {
    const program = this.gl.createProgram()!

    const vertShader = this.gl.createShader(this.gl.VERTEX_SHADER)!
    this.gl.shaderSource(vertShader, vertexShaderSource)
    this.gl.compileShader(vertShader)
    handleShadeCompilationError(this.gl, vertShader)

    const fragShader = this.gl.createShader(this.gl.FRAGMENT_SHADER)!
    this.gl.shaderSource(fragShader, fragmentShaderSource)
    this.gl.compileShader(fragShader)
    handleShadeCompilationError(this.gl, fragShader)

    this.gl.attachShader(program, vertShader)
    this.gl.attachShader(program, fragShader)
    this.gl.linkProgram(program)

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const error = this.gl.getProgramInfoLog(program)
      throw new Error(`Failed to compile shader: ${error}`)
    }

    return { vs: vertShader, fs: fragShader, program }
  }

  public detachShader(program: WebGLProgram, shader: WebGLShader) {
    this.gl.detachShader(program, shader)
  }

  public deleteProgram(program: WebGLContext.ProgramSet) {
    this.gl.detachShader(program.program, program.vs)
    this.gl.detachShader(program.program, program.fs)
    this.gl.deleteProgram(program.program)
  }

  public applyProgram(
    program: WebGLContext.ProgramSet,
    uniforms: { [uniformName: string]: Uniform },
    source: TexImageSource,
    dest: HTMLCanvasElement | OffscreenCanvas
  ) {
    const { gl } = this

    gl.clearColor(0, 0, 0, 1)
    gl.clearDepth(1)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]),
      gl.STATIC_DRAW
    )

    gl.useProgram(program.program)

    const positionAttrib = gl.getAttribLocation(program.program, 'position')
    gl.enableVertexAttribArray(positionAttrib)
    gl.vertexAttribPointer(positionAttrib, 2, gl.FLOAT, false, 0, 0)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.tex2DBuffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]),
      gl.STATIC_DRAW
    )

    const coordAttrib = gl.getAttribLocation(program.program, 'coord')
    gl.enableVertexAttribArray(coordAttrib)
    gl.vertexAttribPointer(coordAttrib, 2, gl.FLOAT, false, 0, 0)

    const tex = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    // Attach source uniform
    const sourceLoc = gl.getUniformLocation(program.program, 'source')
    gl.uniform1i(sourceLoc, 0)

    const texUniforms = Object.entries(uniforms)
      .filter(([key, uni]) => uni.type === 'texture2d')
      .slice(0, 16)

    const textures = texUniforms.map(([uniName, uni], idx) => {
      if (!uni.value) return
      if (uni.type !== 'texture2d') return

      const tex =
        uni.value instanceof TextureResource
          ? uni.value.tex
          : gl.createTexture()

      gl.activeTexture(gl.TEXTURE0 + 1 + idx)
      gl.bindTexture(gl.TEXTURE_2D, tex)

      if (!(uni.value instanceof TextureResource)) {
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          uni.value
        )
      }

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

      const loc = gl.getUniformLocation(program.program, uniName)
      gl.uniform1i(loc, idx + 1)

      return tex
    })

    // Attach uniforms
    this.attachUniforms(gl, program.program, uniforms)

    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)
    gl.flush()

    this.deleteProgram(program)
    textures.forEach((tex) => tex && gl.deleteTexture(tex))

    const destCtx = dest.getContext('2d')!
    destCtx.clearRect(0, 0, dest.width, dest.height)
    destCtx.drawImage(this.gl.canvas, 0, 0, source.width, source.height)
  }

  // public createTexture() {
  //   return new TextureResource(this.gl.createTexture())
  // }

  // Uniforms
  public uni1i(...value: [number]): Uniform {
    return { type: '1i', value }
  }

  public uni2i(...value: [number, number]): Uniform {
    return { type: '2i', value }
  }

  public uni3i(...value: [number, number, number]): Uniform {
    return { type: '3i', value }
  }

  public uni4i(...value: [number, number, number, number]): Uniform {
    return { type: '4i', value }
  }

  // WebGL2
  // public uni1ui(...value: [number]): Uniform {
  //   return { type: '1ui', value }
  // }

  // public uni2ui(...value: [number, number]): Uniform {
  //   return { type: '2ui', value }
  // }

  // public uni3ui(...value: [number, number, number]): Uniform {
  //   return { type: '3ui', value }
  // }

  // public uni4ui(...value: [number, number, number, number]): Uniform {
  //   return { type: '4ui', value }
  // }

  public uni1f(...value: [number]): Uniform {
    return { type: '1f', value }
  }

  public uni2f(...value: [number, number]): Uniform {
    return { type: '2f', value }
  }

  public uni3f(...value: [number, number, number]): Uniform {
    return { type: '3f', value }
  }

  public uni4f(...value: [number, number, number, number]): Uniform {
    return { type: '4f', value }
  }

  public uni1iv(value: number[]): Uniform {
    return { type: '1iv', value }
  }

  public uni2iv(value: number[]): Uniform {
    return { type: '2iv', value }
  }

  public uni3iv(value: number[]): Uniform {
    return { type: '3iv', value }
  }

  public uni4iv(value: number[]): Uniform {
    return { type: '4iv', value }
  }

  public uni1fv(value: number[]): Uniform {
    return { type: '1fv', value }
  }

  public uni2fv(value: number[]): Uniform {
    return { type: '2fv', value }
  }

  public uni3fv(value: number[]): Uniform {
    return { type: '3fv', value }
  }

  public uni4fv(value: number[]): Uniform {
    return { type: '4fv', value }
  }

  public uni1uiv(value: number[]): Uniform {
    return { type: '1uiv', value }
  }

  public uni2uiv(value: number[]): Uniform {
    return { type: '2uiv', value }
  }

  public uni3uiv(value: number[]): Uniform {
    return { type: '3uiv', value }
  }

  public uni4uiv(value: number[]): Uniform {
    return { type: '4uiv', value }
  }

  public uniMatrix2fv(value: number[]): Uniform {
    return { type: 'matrix2fv', value }
  }

  public uniMatrix3x2fv(value: number[]): Uniform {
    return { type: 'matrix3x2fv', value }
  }

  public uniMatrix4x2fv(value: number[]): Uniform {
    return { type: 'matrix4x2fv', value }
  }

  public uniMatrix2x3fv(value: number[]): Uniform {
    return { type: 'matrix2x3fv', value }
  }

  public uniMatrix3fv(value: number[]): Uniform {
    return { type: 'matrix3fv', value }
  }

  public uniMatrix4x3fv(value: number[]): Uniform {
    return { type: 'matrix4x3fv', value }
  }

  public uniMatrix2x4fv(value: number[]): Uniform {
    return { type: 'matrix2x4fv', value }
  }

  public uniMatrix3x4fv(value: number[]): Uniform {
    return { type: 'matrix3x4fv', value }
  }

  public uniMatrix4fv(value: number[]): Uniform {
    return { type: 'matrix4fv', value }
  }

  public uniTexture2D(value: TexImageSource): Uniform {
    return { type: 'texture2d', value }
  }

  private attachUniforms(
    gl: WebGLRenderingContext,
    program: WebGLProgram,
    uniforms: { [uniform: string]: Uniform }
  ) {
    for (const uniKey of Object.keys(uniforms)) {
      const uni = uniforms[uniKey]
      const loc = gl.getUniformLocation(program, uniKey)

      switch (uni.type) {
        case '1i': {
          gl.uniform1i(loc, uni.value[0])
          break
        }
        case '2i': {
          gl.uniform2i(loc, uni.value[0], uni.value[1])
          break
        }
        case '3i': {
          gl.uniform3i(loc, uni.value[0], uni.value[1], uni.value[2])
          break
        }
        case '4i': {
          gl.uniform4i(
            loc,
            uni.value[0],
            uni.value[1],
            uni.value[2],
            uni.value[3]
          )
          break
        }
        // WebGL2
        // case '1ui': {
        //   gl.uniform1ui(loc, uni.value[0])
        //   break
        // }
        // case '2ui': {
        //   gl.uniform2ui(loc, uni.value[0], uni.value[1])
        //   break
        // }
        // case '3ui': {
        //   gl.uniform3ui(loc, uni.value[0], uni.value[1], uni.value[2])
        //   break
        // }
        // case '4ui': {
        //   gl.uniform4ui(
        //     loc,
        //     uni.value[0],
        //     uni.value[1],
        //     uni.value[2],
        //     uni.value[3]
        //   )
        //   break
        // }
        case '1f': {
          gl.uniform1f(loc, uni.value[0])
          break
        }
        case '2f': {
          gl.uniform2f(loc, uni.value[0], uni.value[1])
          break
        }
        case '3f': {
          gl.uniform3f(loc, uni.value[0], uni.value[1], uni.value[2])
          break
        }
        case '4f': {
          gl.uniform4f(
            loc,
            uni.value[0],
            uni.value[1],
            uni.value[2],
            uni.value[3]
          )
          break
        }
        case '1iv': {
          gl.uniform1iv(loc, uni.value)
          break
        }
        case '2iv': {
          gl.uniform2iv(loc, uni.value)
          break
        }
        case '3iv': {
          gl.uniform3iv(loc, uni.value)
          break
        }
        case '4iv': {
          gl.uniform4iv(loc, uni.value)
          break
        }
        case '1fv': {
          gl.uniform1fv(loc, uni.value)
          break
        }
        case '2fv': {
          gl.uniform2fv(loc, uni.value)
          break
        }
        case '3fv': {
          gl.uniform3fv(loc, uni.value)
          break
        }
        case '4fv': {
          gl.uniform4fv(loc, uni.value)
          break
        }
        // WebGL2
        // case '1uiv': {
        //   gl.uniform1uiv(loc, uni.value)
        //   break
        // }
        // case '2uiv': {
        //   gl.uniform2uiv(loc, uni.value)
        //   break
        // }
        // case '3uiv': {
        //   gl.uniform3uiv(loc, uni.value)
        //   break
        // }
        // case '4uiv': {
        //   gl.uniform4uiv(loc, uni.value)
        //   break
        // }
        case 'matrix2fv': {
          gl.uniformMatrix2fv(loc, false, uni.value)
          break
        }
        // WebGL2
        // case 'matrix3x2fv': {
        //   gl.uniformMatrix3x2fv(loc, false, uni.value)
        //   break
        // }
        // case 'matrix4x2fv': {
        //   gl.uniformMatrix4x2fv(loc, false, uni.value)
        //   break
        // }
        // case 'matrix2x3fv': {
        //   gl.uniformMatrix2x3fv(loc, false, uni.value)
        //   break
        // }
        // case 'matrix3fv': {
        //   gl.uniformMatrix3fv(loc, false, uni.value)
        //   break
        // }

        // WebGL2
        // case 'matrix4x3fv': {
        //   gl.uniformMatrix4x3fv(loc, false, uni.value)
        //   break
        // }
        // case 'matrix2x4fv': {
        //   gl.uniformMatrix2x4fv(loc, false, uni.value)
        //   break
        // }
        // case 'matrix3x4fv': {
        //   gl.uniformMatrix3x4fv(loc, false, uni.value)
        //   break
        // }
        case 'matrix4fv': {
          gl.uniformMatrix4fv(loc, false, uni.value)
          break
        }
        case 'texture2d': {
          // already assigned
          break
        }
        default: {
          throw new Error(`Unknown uniform type ${(uni as any).type}`)
        }
      }
    }
  }
}
