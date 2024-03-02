type ImageDataConstructorLike = {
  (sw: number, sh: number, settings?: ImageDataSettings): ImageData
  (
    data: Uint8ClampedArray,
    sw: number,
    sh?: number,
    settings?: ImageDataSettings,
  ): ImageData
}

type ImageFactory = () => HTMLImageElement
type CanvasFactory = (opt?: { dbgId?: string }) => {
  getContext: HTMLCanvasElement['getContext']
}

let imageDataFactory: {
  (sw: number, sh: number, settings?: ImageDataSettings): ImageData
  (
    data: Uint8ClampedArray,
    sw: number,
    sh?: number,
    settings?: ImageDataSettings,
  ): ImageData
} = (...args: any[]) => {
  // @ts-expect-error
  return new ImageData(...args)
}

let imageBitMapFactory: typeof createImageBitmap = async (...args: any[]) => {
  // @ts-expect-error
  return createImageBitmap(...args)
}
let imageFactory: ImageFactory = () => new Image()
let canvasFactory: CanvasFactory = ({ dbgId } = {}) => {
  const el = document.createElement('canvas')
  el.id = dbgId ?? ''
  return el
}

let CanvasClass: any =
  typeof HTMLCanvasElement !== 'undefined' ? HTMLCanvasElement : void 0

let createdCanvases: Set<WeakRef<HTMLCanvasElement>> = new Set()

export const activeCanvasesCount = () => {
  return [...createdCanvases].filter((r) => r.deref() != null).length
}

export const getCanvasBytes = () => {
  return [...createdCanvases]
    .map((r) => r.deref())
    .reduce((v, c) => v + (c?.width ?? 0) * (c?.height ?? 0) * 4, 0)
}

export const setCanvasImpls = (
  impls: {
    createImageBitmap?: typeof createImageBitmap
    createImageData?: typeof createImageData
    createImage?: ImageFactory
    createCanvas?: CanvasFactory
    CanvasClass?: any
  } = {},
) => {
  if (impls.createImageBitmap != null) {
    imageBitMapFactory = impls.createImageBitmap
  }
  if (impls.createImageData != null) {
    imageDataFactory = impls.createImageData
  }
  if (impls.createImage != null) {
    imageFactory = impls.createImage
  }
  if (impls.createCanvas != null) {
    canvasFactory = impls.createCanvas
  }
  if (impls.CanvasClass != null) {
    CanvasClass = impls.CanvasClass
  }
}

export const createImageBitmapImpl: typeof createImageBitmap = (
  ...args: any[]
) => {
  // @ts-expect-error
  return imageBitMapFactory(...args)
}

export const createImageData: ImageDataConstructorLike = (...args: any[]) => {
  // @ts-expect-error
  return imageDataFactory(...args)
}

export const createImage = () => {
  return imageFactory()
}

export const createCanvas = () => {
  const canvas = canvasFactory()
  createdCanvases.add(new WeakRef(canvas as HTMLCanvasElement))
  return canvas as HTMLCanvasElement
}

export const createWebGL2Context = (options?: WebGLContextAttributes) =>
  canvasFactory().getContext('webgl2')!

export const createContext2D = (
  settings?: CanvasRenderingContext2DSettings & { dbgId?: string },
) => canvasFactory({ dbgId: settings?.dbgId }).getContext('2d', settings)!

export const isCanvasElement = (v: any): v is HTMLCanvasElement => {
  return v instanceof CanvasClass
}
