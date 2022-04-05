let canvasFactory = () => document.createElement('canvas').getContext('2d')!

export const setContext2DFactory = (fn: () => CanvasRenderingContext2D) => {
  canvasFactory = fn
}
export const createContext2D = () => canvasFactory()
