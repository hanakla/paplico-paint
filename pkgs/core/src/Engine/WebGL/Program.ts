import { mapEntries } from '@paplico/shared-lib'
import { TexUniform, TextureClamp, TextureFilter, Uniform } from './types'
import { BufferAttributes } from './meshes/Mesh'

type AttributeNames = {
  vertexAttrib: string
}

export class Program {
  protected vertShader: WebGLShader | null = null
  protected fragShader: WebGLShader | null = null
  protected program: WebGLProgram | null = null

  protected uniforms: Record<string, Uniform> = {}

  constructor(
    protected fragShaderSource: string,
    protected vertShaderSource: string = DEFAULT_VERTEX_SHADER,
  ) {}

  public setUniform(
    name: string,
    type: Exclude<Uniform['type'], 'texture2d'>,
    value: number[],
  ) {
    this.uniforms[name] = {
      type,
      value,
    }
  }

  public setTextureUniform(
    name: string,
    tex: TexImageSource,
    options?:
      | {
          clamp?: TextureClamp | undefined
          filter: TextureFilter
        }
      | undefined,
  ) {
    this.uniforms[name] = {
      type: 'texture2d',
      value: tex,
      clamp: options?.clamp ?? 'repeat',
      filter: options?.filter ?? 'linear',
    }
  }

  public uni(
    type: Omit<Uniform['type'], 'texture2d'>,
    values: number[] | Float32Array,
  ): Uniform {
    return {
      type: type as any,
      value: values,
    }
  }

  public createTexture(
    tex: TexImageSource,
    options?:
      | {
          clamp?: TextureClamp | undefined
          filter: TextureFilter
        }
      | undefined,
  ): TexUniform {
    // const { gl } = this

    // const texUni = new TextureResource(gl.createTexture()!)

    // gl.activeTexture(gl.TEXTURE0)
    // gl.bindTexture(gl.TEXTURE_2D, texUni.tex)
    // gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1)
    // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tex)

    // if (options?.filter) {
    //   gl.texParameteri(
    //     gl.TEXTURE_2D,
    //     gl.TEXTURE_MIN_FILTER,
    //     getTextureFilterValue(gl, options.filter, 'min')!,
    //   )
    //   gl.texParameteri(
    //     gl.TEXTURE_2D,
    //     gl.TEXTURE_MAG_FILTER,
    //     getTextureFilterValue(gl, options.filter, 'mag')!,
    //   )
    // }

    // gl.texParameteri(
    //   gl.TEXTURE_2D,
    //   gl.TEXTURE_WRAP_S,
    //   getTextureClampValue(gl, options?.clamp ?? 'clampToEdge', 'x'),
    // )
    // gl.texParameteri(
    //   gl.TEXTURE_2D,
    //   gl.TEXTURE_WRAP_T,
    //   getTextureClampValue(gl, options?.clamp ?? 'clampToEdge', 'y'),
    // )

    return {
      type: 'texture2d',
      value: tex,
      clamp: options?.clamp ?? 'clampToEdge',
      filter: options?.filter ?? 'linear',
    }
  }

  public compile(gl: WebGL2RenderingContext) {
    if (this.program) return this.program

    const vertShader = (this.vertShader = gl.createShader(gl.VERTEX_SHADER)!)
    gl.shaderSource(vertShader, this.vertShaderSource)
    gl.compileShader(vertShader)
    handleShadeCompilationError(gl, vertShader, 'vertex')

    const fragShader = (this.fragShader = gl.createShader(gl.FRAGMENT_SHADER)!)
    gl.shaderSource(fragShader, this.fragShaderSource)
    gl.compileShader(fragShader)
    handleShadeCompilationError(gl, fragShader, 'fragment')

    const program = (this.program = gl.createProgram()!)
    gl.attachShader(program, vertShader)
    gl.attachShader(program, fragShader)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const error = gl.getProgramInfoLog(program)
      throw new Error(`Failed to link program: \n${error}`)
    }

    return program

    function handleShadeCompilationError(
      gl: WebGL2RenderingContext,
      shader: WebGLShader,
      kind: 'vertex' | 'fragment',
    ) {
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader)
        throw new Error(`Failed to compile ${kind} shader: \n${log}`)
      }
    }
  }

  public attachAttributes(
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    attribs: BufferAttributes,
  ) {
    console.info('Attaching attributes', attribs)
    mapEntries(attribs, ([name, { buffer, itemSize, stride, offset }]) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)

      const attrib = gl.getAttribLocation(program, name)
      if (attrib < 0) console.warn(`Warn: Attribute ${name} is not found`)
      gl.enableVertexAttribArray(attrib)
      gl.vertexAttribPointer(attrib, itemSize, gl.FLOAT, false, stride, offset)
    })
  }

  public attachUniforms(gl: WebGL2RenderingContext, program: WebGLProgram) {
    if (this.program !== program) {
      throw new Error('Program is not compiled')
    }

    // const uniforms = this.uniforms

    // for (const name in uniforms) {
    //   const loc = gl.getUniformLocation(program, name)
    //   if (!loc) {
    //     throw new Error(`Uniform ${name} is not found`)
    //   }

    //   uniforms[name] = loc
    // }
  }
}

const DEFAULT_VERTEX_SHADER = `
precision mediump float;

attribute vec3 aPosition;
varying vec2 vUv;

void main(void) {
  vUv = aPosition.xy;
  gl_Position = vec4(aPosition, 1.0);
}
`

const getTextureClampValue = (
  gl: WebGL2RenderingContext,
  value: TextureClamp,
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
  value: TextureFilter | null,
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
