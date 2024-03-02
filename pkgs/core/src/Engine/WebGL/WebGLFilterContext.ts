import { saveAndRestoreCanvas, setCanvasSize } from '@/utils/canvas'
import {
  IFilterWebGLContext,
  InputSource,
  RenderTarget,
  PPLCFilterProgram,
  PPLCRenderTarget,
  PPLCUniforms,
  TexUniform,
  WebGLTypes,
  __papRenderTargetMark,
  __paplicoFilterProgram,
} from './FilterContextAbst'
import { createWebGL2Context } from '@/Infra/CanvasFactory'
import { logImage } from '@/utils/DebugHelper'

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

type WebGLRenderTarget = {
  frameBuffer: WebGLFramebuffer
  // renderBuffer: WebGLRenderbuffer
  texture: WebGLTexture
  width: number
  height: number
}

export class WebGLFilterContext implements IFilterWebGLContext {
  private gl: WebGL2RenderingContext

  private vertBuf: WebGLBuffer
  private texQuadBuf: WebGLBuffer
  private inputTex: WebGLTexture

  constructor() {
    const gl = (this.gl = createWebGL2Context({
      alpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
      premultipliedAlpha: true,
    }))
    if ('id' in gl.canvas) gl.canvas.id = '__paplico-fx-gl-canvas'
    // gl.canvas.setAttribute?.('name', '__paplico-fx-gl-canvas')
    this.gl = gl

    document.body.appendChild(gl.canvas)

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
      gl.STATIC_DRAW,
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
      gl.STATIC_DRAW,
    )
    gl.bindBuffer(gl.ARRAY_BUFFER, null)

    this.inputTex = gl.createTexture()!
  }

  public dispose() {
    this.gl.deleteBuffer(this.vertBuf)
    this.gl.deleteBuffer(this.texQuadBuf)
    this.gl.deleteTexture(this.inputTex)
  }

  public setSize(width: number, height: number) {
    setCanvasSize(this.gl.canvas, { width, height })
    this.gl.viewport(0, 0, width, height)
  }

  public createProgram(
    fragSource: string,
    vertSource: string = DEFAULT_VERTEX_SHADER,
  ): PPLCFilterProgram {
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

    return {
      [__paplicoFilterProgram]: true,
      program: prog,
      dispose: () => {
        gl.deleteShader(vert)
        gl.deleteShader(frag)
        gl.deleteProgram(prog)
      },
    }
  }

  public createTexture(
    tex: TexImageSource,
    options?:
      | {
          clamp?: WebGLTypes.TextureClamp | undefined
          filter: WebGLTypes.TextureFilter
        }
      | undefined,
  ): TexUniform {
    const { gl } = this

    const texUni = new TextureResource(gl.createTexture()!)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texUni.tex)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tex)

    if (options?.filter) {
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        getTextureFilterValue(gl, options.filter, 'min')!,
      )
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MAG_FILTER,
        getTextureFilterValue(gl, options.filter, 'mag')!,
      )
    }

    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_WRAP_S,
      getTextureClampValue(gl, options?.clamp ?? 'clampToEdge', 'x'),
    )
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_WRAP_T,
      getTextureClampValue(gl, options?.clamp ?? 'clampToEdge', 'y'),
    )

    return {
      type: 'texture2d',
      value: tex,
      clamp: options?.clamp ?? 'clampToEdge',
      filter: options?.filter ?? 'linear',
      toNativeUniform() {
        return { value: texUni }
      },
    }
  }

  public createRenderTarget(
    width: number,
    height: number,
  ): PPLCRenderTarget<WebGLRenderTarget> {
    const { gl } = this

    const fbo = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)

    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    )

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      tex,
      0,
    )

    // const depthBuf = gl.createRenderbuffer()!
    // gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuf)
    // gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height)
    // gl.framebufferRenderbuffer(
    //   gl.FRAMEBUFFER,
    //   gl.DEPTH_ATTACHMENT,
    //   gl.RENDERBUFFER,
    //   depthBuf,
    // )

    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.bindRenderbuffer(gl.RENDERBUFFER, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    return {
      [__papRenderTargetMark]: true,
      renderTarget: {
        frameBuffer: fbo,
        // renderBuffer: depthBuf,
        texture: tex,
        width,
        height,
      },
      dispose: () => {
        gl.deleteFramebuffer(fbo)
        gl.deleteTexture(tex)
        // gl.deleteRenderbuffer(depthBuf)
      },
    }
  }

  public uni(
    type: Omit<PPLCUniforms['type'], 'texture2d'>,
    values: number[] | Float32Array,
  ): PPLCUniforms {
    return {
      type: type as any,
      value: values,
      toNativeUniform: () => ({ value: values }),
    }
  }

  public apply(
    input: InputSource<WebGLRenderTarget>,
    output: RenderTarget,
    prog: PPLCFilterProgram,
    uniforms: { [uniformName: string]: PPLCUniforms },
  ) {
    const { gl } = this

    // const convertedUniforms = Object.entries(uniforms).reduce(
    //   (acc, [key, value]) => {
    //     acc[key] = value.toNativeUniform()
    //     return acc
    //   },
    //   {} as Record<string, any>,
    // )

    const outputSize =
      output instanceof CanvasRenderingContext2D
        ? { width: output.canvas.width, height: output.canvas.height }
        : output instanceof OffscreenCanvasRenderingContext2D
        ? { width: output.canvas.width, height: output.canvas.height }
        : {
            width: output.renderTarget.width,
            height: output.renderTarget.height,
          }

    // Initialize
    setCanvasSize(this.gl.canvas, outputSize ?? output)
    gl.viewport(0, 0, outputSize.width, outputSize.height)

    gl.enable(gl.BLEND)
    gl.blendFuncSeparate(
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
    )
    gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD)

    gl.depthMask(true)
    gl.colorMask(true, true, true, true)
    gl.blendColor(0, 0, 0, 0)

    gl.clearColor(0, 0, 0, 0)
    gl.clearDepth(1)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    gl.useProgram(prog.program)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertBuf)
    const positionAttrib = gl.getAttribLocation(prog.program, 'aPosition')
    gl.enableVertexAttribArray(positionAttrib)
    gl.vertexAttribPointer(positionAttrib, 2, gl.FLOAT, false, 0, 0)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texQuadBuf)
    const coordAttrib = gl.getAttribLocation(prog.program, 'aCoord')
    gl.enableVertexAttribArray(coordAttrib)
    gl.vertexAttribPointer(coordAttrib, 2, gl.FLOAT, false, 0, 0)

    gl.bindBuffer(gl.ARRAY_BUFFER, null)

    // Attach source texture
    {
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.inputTex)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1)

      if (__papRenderTargetMark in input) {
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          input.renderTarget.texture,
          0,
        )
      } else {
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          input,
        )
      }

      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        // getTextureFilterValue(gl, sourceTexFilter, 'min')!,
        gl.LINEAR,
      )
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MAG_FILTER,
        // getTextureFilterValue(gl, sourceTexFilter, 'mag')!,
        gl.LINEAR,
      )

      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_WRAP_S,
        // getTextureClampValue(gl, sourceTextureClamp, 'x'),
        gl.CLAMP_TO_EDGE,
      )
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_WRAP_T,
        // getTextureClampValue(gl, sourceTextureClamp, 'y'),
        gl.CLAMP_TO_EDGE,
      )

      const sourceUniLoc = gl.getUniformLocation(prog.program, 'uTexture')
      gl.uniform1i(sourceUniLoc, 0)
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
          uni.value,
        )
      }

      if (uni.filter) {
        gl.texParameteri(
          gl.TEXTURE_2D,
          gl.TEXTURE_MIN_FILTER,
          getTextureFilterValue(gl, uni.filter, 'min')!,
        )
        gl.texParameteri(
          gl.TEXTURE_2D,
          gl.TEXTURE_MAG_FILTER,
          getTextureFilterValue(gl, uni.filter, 'mag')!,
        )
      }

      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_WRAP_S,
        getTextureClampValue(gl, uni.clamp, 'x'),
      )
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_WRAP_T,
        getTextureClampValue(gl, uni.clamp, 'y'),
      )

      const loc = gl.getUniformLocation(prog.program, uniName)
      gl.uniform1i(loc, textureIdx)

      return tex
    })

    // Attach uniforms
    this.attachUniforms(gl, prog.program, uniforms)

    if (__papRenderTargetMark in output) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, output.renderTarget.frameBuffer)
      gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)
      gl.flush()
    } else {
      gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)
      gl.flush()

      saveAndRestoreCanvas(output, (outCtx) => {
        outCtx.globalCompositeOperation = 'source-over'
        outCtx.globalAlpha = 1
        outCtx.drawImage(
          gl.canvas,
          0,
          0,
          outputSize.width,
          outputSize.height,
          0,
          0,
          outputSize.width,
          outputSize.height,
        )
      })
    }

    textures.forEach((tex) => tex && gl.deleteTexture(tex))
  }

  // Uniforms
  // public uni1i(...value: [number]): PPLCUniforms {
  //   return { type: '1i', value }
  // }

  // public uni2i(...value: [number, number]): PPLCUniforms {
  //   return { type: '2i', value }
  // }

  // public uni3i(...value: [number, number, number]): PPLCUniforms {
  //   return { type: '3i', value }
  // }

  // public uni4i(...value: [number, number, number, number]): PPLCUniforms {
  //   return { type: '4i', value }
  // }

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

  // public uni1f(...value: [number]): PPLCUniforms {
  //   return { type: '1f', value, toNativeUniform }
  // }

  // public uni2f(...value: [number, number]): PPLCUniforms {
  //   return { type: '2f', value }
  // }

  // public uni3f(...value: [number, number, number]): PPLCUniforms {
  //   return { type: '3f', value }
  // }

  // public uni4f(...value: [number, number, number, number]): PPLCUniforms {
  //   return { type: '4f', value }
  // }

  // public uni1iv(value: number[]): PPLCUniforms {
  //   return { type: '1iv', value }
  // }

  // public uni2iv(value: number[]): PPLCUniforms {
  //   return { type: '2iv', value }
  // }

  // public uni3iv(value: number[]): PPLCUniforms {
  //   return { type: '3iv', value }
  // }

  // public uni4iv(value: number[]): PPLCUniforms {
  //   return { type: '4iv', value }
  // }

  // public uni1fv(value: number[] | Float32Array): PPLCUniforms {
  //   return { type: '1fv', value }
  // }

  // public uni2fv(value: number[] | Float32Array): PPLCUniforms {
  //   return { type: '2fv', value }
  // }

  // public uni3fv(value: number[] | Float32Array): PPLCUniforms {
  //   return { type: '3fv', value }
  // }

  // public uni4fv(value: number[] | Float32Array): PPLCUniforms {
  //   return { type: '4fv', value }
  // }

  // public uni1uiv(value: number[]): PPLCUniforms {
  //   return { type: '1uiv', value }
  // }

  // public uni2uiv(value: number[]): PPLCUniforms {
  //   return { type: '2uiv', value }
  // }

  // public uni3uiv(value: number[]): PPLCUniforms {
  //   return { type: '3uiv', value }
  // }

  // public uni4uiv(value: number[]): PPLCUniforms {
  //   return { type: '4uiv', value }
  // }

  // public uniMatrix2fv(value: number[]): PPLCUniforms {
  //   return { type: 'matrix2fv', value }
  // }

  // public uniMatrix3x2fv(value: number[]): PPLCUniforms {
  //   return { type: 'matrix3x2fv', value }
  // }

  // public uniMatrix4x2fv(value: number[]): PPLCUniforms {
  //   return { type: 'matrix4x2fv', value }
  // }

  // public uniMatrix2x3fv(value: number[]): PPLCUniforms {
  //   return { type: 'matrix2x3fv', value }
  // }

  // public uniMatrix3fv(value: number[]): PPLCUniforms {
  //   return { type: 'matrix3fv', value }
  // }

  // public uniMatrix4x3fv(value: number[]): PPLCUniforms {
  //   return { type: 'matrix4x3fv', value }
  // }

  // public uniMatrix2x4fv(value: number[]): PPLCUniforms {
  //   return { type: 'matrix2x4fv', value }
  // }

  // public uniMatrix3x4fv(value: number[]): PPLCUniforms {
  //   return { type: 'matrix3x4fv', value }
  // }

  // public uniMatrix4fv(value: number[]): PPLCUniforms {
  //   return { type: 'matrix4fv', value }
  // }

  // public uniTexture2D(
  //   value: TexImageSource,
  //   {
  //     clamp = 'clampToEdge',
  //     filter = 'linear',
  //   }: {
  //     clamp?: WebGLContext.TextureClamp
  //     filter?: WebGLContext.TextureFilter
  //   } = {},
  // ): PPLCUniforms {
  //   return { type: 'texture2d', value, clamp, filter }
  // }

  private attachUniforms(
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    uniforms: { [uniform: string]: PPLCUniforms },
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
            uni.value[3],
          )
          break
        }
        // WebGL2
        case '1ui': {
          gl.uniform1ui(loc, uni.value[0])
          break
        }
        case '2ui': {
          gl.uniform2ui(loc, uni.value[0], uni.value[1])
          break
        }
        case '3ui': {
          gl.uniform3ui(loc, uni.value[0], uni.value[1], uni.value[2])
          break
        }
        case '4ui': {
          gl.uniform4ui(
            loc,
            uni.value[0],
            uni.value[1],
            uni.value[2],
            uni.value[3],
          )
          break
        }
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
            uni.value[3],
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
  gl: WebGL2RenderingContext,
  shader: WebGLShader,
) => {
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader)
    throw new Error(`Failed to compile shader: \n${log}`)
  }
}

const getTextureClampValue = (
  gl: WebGL2RenderingContext,
  value: WebGLContext.TextureClamp,
  xy: 'x' | 'y',
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
  gl: WebGL2RenderingContext,
  value: WebGLContext.TextureFilter | null,
  minmag: 'min' | 'mag',
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
