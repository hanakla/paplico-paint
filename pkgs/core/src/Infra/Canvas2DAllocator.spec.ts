import { Mock } from 'vitest'
import { CanvasFactory } from '../Engine'
import { Canvas2DAllocator } from './Canvas2DAllocator'

type MockCanvas2D = {
  save: Mock
  option: any
  canvas: {
    width: number
    height: number
  }
}

describe('Canvas2DAllocator', () => {
  beforeAll(() => {
    vi.mock('./CanvasFactory', () => {
      return {
        createContext2D(option: any) {
          return {
            save: vi.fn(),
            restore: vi.fn(),
            option,
            canvas: {
              remove: vi.fn(),
              width: 0,
              height: 0,
            },
          }
        },
      }
    })
  })

  beforeEach(() => {
    Canvas2DAllocator.gc({ __testOnlyForceCollectAll: true })
  })

  describe('borrow', () => {
    it('should return a specified size canvas', () => {
      const ctx = Canvas2DAllocator.borrow({
        width: 100,
        height: 100,
      }) as unknown as MockCanvas2D

      expect(ctx.canvas.width).toBe(100)
      expect(ctx.canvas.height).toBe(100)
      expect(ctx.option).toEqual({})

      const ctx2 = Canvas2DAllocator.borrow({
        width: 200,
        height: 200,
      }) as unknown as MockCanvas2D

      expect(ctx2.canvas.width).toBe(200)
      expect(ctx2.canvas.height).toBe(200)
      expect(ctx2.option).toEqual({})
    })

    it('should return a canvas with specified option', () => {
      const ctx = Canvas2DAllocator.borrow({
        width: 100,
        height: 100,
        willReadFrequently: true,
      })

      expect(ctx.option).toEqual({
        willReadFrequently: true,
      })
    })

    it.only('should reuse a canvas with same size and option', () => {
      console.log('borrow')
      const ctx = Canvas2DAllocator.borrow({
        width: 100,
        height: 100,
      })
      Canvas2DAllocator.return(ctx)

      const ctx2 = Canvas2DAllocator.borrow({
        width: 100,
        height: 100,
      })

      expect(ctx).toBe(ctx2)
      expect(Canvas2DAllocator.allocated.length).toBe(1)
      Canvas2DAllocator.return(ctx2)

      const ctx3 = Canvas2DAllocator.borrow({
        width: 100,
        height: 100,
        willReadFrequently: true,
      })

      expect(ctx).not.toBe(ctx3)
      expect(ctx3.option).toEqual({
        willReadFrequently: true,
      })
    })
  })
})
