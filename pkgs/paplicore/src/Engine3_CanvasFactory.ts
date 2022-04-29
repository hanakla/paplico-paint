type Factory = () => { getContext: HTMLCanvasElement['getContext'] }

let canvasFactory: Factory = () => document.createElement('canvas')
let createdCanvases: Set<WeakRef<HTMLCanvasElement>> = new Set()

export const getCanvasBytes = () => {
  return [...createdCanvases]
    .map((r) => r.deref())
    .reduce((v, c) => v + (c?.width ?? 0) * (c?.height ?? 0) * 4, 0)
}

export const setCanvasFactory = (fn: Factory) => {
  canvasFactory = fn
}

export const createCanvas = () => {
  const canvas = canvasFactory()
  createdCanvases.add(new WeakRef(canvas as HTMLCanvasElement))
  return canvas
}
export const createWebGLContext = (options?: WebGLContextAttributes) =>
  canvasFactory().getContext('webgl', options)!
export const createContext2D = () => canvasFactory().getContext('2d')!
