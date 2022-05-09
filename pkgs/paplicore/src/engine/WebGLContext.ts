import { setCanvasSize } from '../utils'
import { createContext2D, createWebGLContext } from '../Engine3_CanvasFactory'
import { logImage } from '../DebugHelper'
import { saveAndRestoreCanvas } from '../utils/canvas'

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
      value: ReadonlyArray<number> | Float32Array
    }
  | {
      type: 'texture2d'
      value: TexImageSource | TextureResource
      clamp: WebGLContext.TextureClamp
      filter: WebGLContext.TextureFilter
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

export declare namespace WebGLContext {
  // export type ProgramSet = {
  //   vs: WebGLShader
  //   fs: WebGLShader
  //   program: WebGLProgram
  // }
  export type ProgramSet = WebGLProgram

  export type TextureClampValue = 'repeat' | 'mirroredRepeat' | 'clampToEdge'
  export type TextureClamp =
    | TextureClampValue
    | { x: TextureClampValue; y: TextureClampValue }

  export type TextureFilterValue = 'nearest' | 'linear'
  export type TextureFilter =
    | TextureFilterValue
    | { min: TextureFilterValue; mag: TextureFilterValue }
}

const getExtension = <
  K extends Parameters<WebGLRenderingContext['getExtension']>[0]
>(
  gl: WebGLRenderingContext,
  name: K
) => {
  const ext = gl.getExtension(name)
  if (!ext) console.warn(`Extension ${name} not supported`)
  return ext
}

export class WebGLContext {
  private gl: WebGLRenderingContext

  private vertBuf: WebGLBuffer
  private texQuadBuf: WebGLBuffer
  private inputTex: WebGLTexture

  constructor() {
    const gl = (this.gl = createWebGLContext({
      alpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
      premultipliedAlpha: true,
    }))
    gl.canvas.id = '__paplico-fx-gl-canvas'
    gl.canvas.setAttribute('name', '__paplico-fx-gl-canvas')

    setCanvasSize(this.gl.canvas, 1, 1)
    gl.viewport(0, 0, 1, 1)

    this.vertBuf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertBuf)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      // prettier-ignore
      new Float32Array([
        -1, -1,
        1, -1,
        1, 1,
        -1, 1
      ]),
      gl.STATIC_DRAW
    )
    gl.bindBuffer(gl.ARRAY_BUFFER, null)

    this.texQuadBuf = this.gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texQuadBuf)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      // prettier-ignore
      new Float32Array([
        0, 1,
        1, 1,
        1, 0,
        0, 0
      ]),
      gl.STATIC_DRAW
    )
    gl.bindBuffer(gl.ARRAY_BUFFER, null)

    this.inputTex = gl.createTexture()!
  }

  public setSize(width: number, height: number) {
    setCanvasSize(this.gl.canvas, { width, height })
    this.gl.viewport(0, 0, width, height)
  }

  public createProgram(
    fragSource: string,
    vertSource: string = DEFAULT_VERTEX_SHADER
  ) {
    const { gl } = this

    const vert = gl.createShader(gl.VERTEX_SHADER)!
    gl.shaderSource(vert, vertSource)
    gl.compileShader(vert)
    handleShadeCompilationError(gl, vert)

    const frag = gl.createShader(gl.FRAGMENT_SHADER)!
    gl.shaderSource(frag, fragSource)
    gl.compileShader(frag)
    handleShadeCompilationError(gl, frag)

    const prog = gl.createProgram()!
    gl.attachShader(prog, vert)
    gl.attachShader(prog, frag)
    gl.linkProgram(prog)

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const error = gl.getProgramInfoLog(prog)
      throw new Error(`Failed to compile shader: ${error}`)
    }

    return prog
  }

  public applyProgram(
    prog: WebGLProgram,
    uniforms: { [uniformName: string]: Uniform },
    input: TexImageSource,
    output: HTMLCanvasElement | OffscreenCanvas,
    {
      sourceTextureClamp = 'clampToEdge',
      sourceTexFilter = 'linear',
      clear = false,
    }: {
      sourceTextureClamp?: WebGLContext.TextureClamp
      sourceTexFilter?: WebGLContext.TextureFilter
      clear?: boolean
    } = {}
  ) {
    const { gl } = this

    // Initialize
    setCanvasSize(this.gl.canvas, output)
    gl.viewport(0, 0, output.width, output.height)

    gl.enable(gl.BLEND)
    gl.blendFuncSeparate(
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA
    )
    gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD)

    gl.depthMask(true)
    gl.colorMask(true, true, true, true)
    gl.blendColor(0, 0, 0, 0)

    gl.clearColor(0, 0, 0, 0)
    gl.clearDepth(1)
    gl.clearStencil(0)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    gl.useProgram(prog)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertBuf)
    const positionAttrib = gl.getAttribLocation(prog, 'aPosition')
    gl.enableVertexAttribArray(positionAttrib)
    gl.vertexAttribPointer(positionAttrib, 2, gl.FLOAT, false, 0, 0)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texQuadBuf)
    const coordAttrib = gl.getAttribLocation(prog, 'aCoord')
    gl.enableVertexAttribArray(coordAttrib)
    gl.vertexAttribPointer(coordAttrib, 2, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)

    // Attach source texture
    {
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.inputTex)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, input)

      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        getTextureFilterValue(gl, sourceTexFilter, 'min')!
      )
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MAG_FILTER,
        getTextureFilterValue(gl, sourceTexFilter, 'mag')!
      )
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_WRAP_S,
        getTextureClampValue(gl, sourceTextureClamp, 'x')
      )
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_WRAP_T,
        getTextureClampValue(gl, sourceTextureClamp, 'y')
      )

      const sourceLoc = gl.getUniformLocation(prog, 'source')
      gl.uniform1i(sourceLoc, 0)
    }

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
      const textureIdx = 1 + idx

      gl.activeTexture(gl.TEXTURE0 + textureIdx)
      gl.bindTexture(gl.TEXTURE_2D, tex)

      if (!(uni.value instanceof TextureResource)) {
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1)
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          uni.value
        )
      }

      if (uni.filter) {
        gl.texParameteri(
          gl.TEXTURE_2D,
          gl.TEXTURE_MIN_FILTER,
          getTextureFilterValue(gl, uni.filter, 'min')!
        )
        gl.texParameteri(
          gl.TEXTURE_2D,
          gl.TEXTURE_MAG_FILTER,
          getTextureFilterValue(gl, uni.filter, 'mag')!
        )
      }

      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_WRAP_S,
        getTextureClampValue(gl, uni.clamp, 'x')
      )
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_WRAP_T,
        getTextureClampValue(gl, uni.clamp, 'y')
      )

      const loc = gl.getUniformLocation(prog, uniName)
      gl.uniform1i(loc, textureIdx)

      return tex
    })

    // Attach uniforms
    this.attachUniforms(gl, prog, uniforms)

    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)
    gl.flush()

    textures.forEach((tex) => tex && gl.deleteTexture(tex))

    const tmp = createContext2D()
    setCanvasSize(tmp.canvas, output)
    tmp.drawImage(this.gl.canvas, 0, 0)

    saveAndRestoreCanvas(output.getContext('2d')!, (outCtx) => {
      // console.log('hi')
      outCtx.globalCompositeOperation = 'source-over'
      clear && outCtx.clearRect(0, 0, output.width, output.height)
      clear && (outCtx.fillStyle = 'rgba(255,255,255,0)')
      clear && outCtx.fillRect(0, 0, output.width, output.height)
      outCtx.drawImage(tmp.canvas, 0, 0)
    })
  }

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

  public uni1fv(value: number[] | Float32Array): Uniform {
    return { type: '1fv', value }
  }

  public uni2fv(value: number[] | Float32Array): Uniform {
    return { type: '2fv', value }
  }

  public uni3fv(value: number[] | Float32Array): Uniform {
    return { type: '3fv', value }
  }

  public uni4fv(value: number[] | Float32Array): Uniform {
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

  public uniTexture2D(
    value: TexImageSource,
    {
      clamp = 'clampToEdge',
      filter = 'linear',
    }: {
      clamp?: WebGLContext.TextureClamp
      filter?: WebGLContext.TextureFilter
    } = {}
  ): Uniform {
    return { type: 'texture2d', value, clamp, filter }
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

const DEFAULT_VERTEX_SHADER = `
precision highp float;

attribute vec2 aPosition;
attribute vec2 aCoord;

varying vec2 vUv;
varying vec2 vTexCoord;

void main(void) {
    vUv = aCoord;
    vTexCoord = aCoord;
    gl_Position = vec4(aPosition, 0.0, 1.0);
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

const getTextureClampValue = (
  gl: WebGLRenderingContext,
  value: WebGLContext.TextureClamp,
  xy: 'x' | 'y'
): number => {
  if (typeof value === 'string') {
    return (
      // prettier-ignore
      value === 'clampToEdge' ? gl.CLAMP_TO_EDGE
      : value === 'mirroredRepeat' ? gl.MIRRORED_REPEAT
      : value === 'repeat' ? gl.REPEAT
      : null as never
    )
  } else {
    let dir = xy === 'x' ? value.x : value.y
    return getTextureClampValue(gl, dir, xy)
  }
}

const getTextureFilterValue = (
  gl: WebGLRenderingContext,
  value: WebGLContext.TextureFilter | null,
  minmag: 'min' | 'mag'
): number | null => {
  if (typeof value === 'string') {
    // prettier-ignore
    return (
      value === 'linear' ? gl.LINEAR
      : value === 'nearest' ? gl.NEAREST
      : null
    )
  } else if (value != null) {
    let val = minmag === 'min' ? value.min : value.mag
    return getTextureFilterValue(gl, val, minmag)
  }

  return null
}
