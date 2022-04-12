type Factory = () => { getContext: HTMLCanvasElement['getContext'] }

let canvasFactory: Factory = () => document.createElement('canvas')

export const setCanvasFactory = (fn: Factory) => {
  canvasFactory = fn
}

export const createCanvas = () => canvasFactory()
export const createWebGLContext = () => canvasFactory().getContext('webgl')!
export const createContext2D = () => canvasFactory().getContext('2d')!
