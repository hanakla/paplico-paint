let canvasFactory = () => document.createElement('canvas').getContext('2d')!

export const setCanvasFactory = (fn: () => CanvasRenderingContext2D) => {
  canvasFactory = fn
}
export const createCanvas = () => canvasFactory()
