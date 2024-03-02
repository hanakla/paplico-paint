export type Uniform =
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
  | TexUniform

export type TexUniform = {
  type: 'texture2d'
  value: TexImageSource
  clamp: TextureClamp
  filter: TextureFilter
}

export type TextureClampValue = 'repeat' | 'mirroredRepeat' | 'clampToEdge'
export type TextureClamp =
  | TextureClampValue
  | { x: TextureClampValue; y: TextureClampValue }

export type TextureFilterValue = 'nearest' | 'linear'
export type TextureFilter =
  | TextureFilterValue
  | { min: TextureFilterValue; mag: TextureFilterValue }
