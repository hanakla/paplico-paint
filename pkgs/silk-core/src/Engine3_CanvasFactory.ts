type Factory = () => { getContext: HTMLCanvasElement['getContext'] }

let canvasFactory: Factory = () => document.createElement('canvas')

export const setCanvasFactory = (fn: Factory) => {
  canvasFactory = fn
}

export const createCanvas = () => canvasFactory()
export const createWebGLContext = (options?: WebGLContextAttributes) =>
  canvasFactory().getContext('webgl', options)!
export const createContext2D = () => canvasFactory().getContext('2d')!
