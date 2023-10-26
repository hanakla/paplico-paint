export type PapFilterProgram<T = any> = {
  [__paplicoFilterProgram]: true
  program: T
}

export type PapRenderTarget<T = any> = {
  [__papRenderTargetMark]: true
  renderTarget: T
}

export type InputSource = TexImageSource | PapRenderTarget

export type OutputTarget =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D
  | PapRenderTarget

export type PapUniforms =
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
      toNativeUniform: () => any
    }
  | TexUniform

export type TexUniform = {
  type: 'texture2d'
  value: TexImageSource
  clamp: WebGLTypes.TextureClamp
  filter: WebGLTypes.TextureFilter
  toNativeUniform: () => any
}

export declare namespace WebGLTypes {
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

export interface FilterWebGLContext {
  dispose(): void
  createRenderTarget(width: number, height: number): PapRenderTarget<any>
  createProgram(frag: string, vert?: string): PapFilterProgram<any>
  createTexture(
    tex: TexImageSource,
    options?: {
      clamp?: WebGLTypes.TextureClamp
      filter: WebGLTypes.TextureFilter
    },
  ): TexUniform
  uni(
    type: Omit<PapUniforms['type'], 'texture2d'>,
    values: number[] | Float32Array,
  ): PapUniforms
  apply(
    program: PapFilterProgram,
    uniforms: Record<string, PapUniforms>,
    input: InputSource,
    output: OutputTarget,
  ): void
}

export const __papRenderTargetMark = Symbol('__papRenderTargetMark')
export const __paplicoFilterProgram = Symbol('__paplicoFilterProgram')
