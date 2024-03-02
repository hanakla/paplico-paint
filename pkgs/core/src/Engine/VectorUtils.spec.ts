import {
  createVectorObjectVisually,
  createVectorPath,
} from '@/Document/Visually/factory'
import {
  applyTransformToVectorPath,
  vectorObjectTransformToMatrix,
} from './VectorUtils'

describe('VectorUtils', () => {
  describe('DOMMatrix', () => {
    // broke this test by DOMMatrix internals references native DOMMatrix directly
    it.skip('test', () => {
      const matrix = vectorObjectTransformToMatrix(
        createVectorObjectVisually({
          transform: {
            translate: { x: 1, y: 2 },
            scale: { x: 3, y: 4 },
            rotate: 5,
          },
          path: createVectorPath({
            fillRule: 'nonzero',
            points: [{ isMoveTo: true, x: 0, y: 0 }],
            randomSeed: 0,
          }),
        }),
      )

      expect(matrix).toMatchObject(new DOMMatrix(matrix).toFloat64Array())
    })
  })

  describe('applyTransformToVectorPath', () => {
    it('simple translate', () => {
      const path = createVectorPath({
        points: [
          { isMoveTo: true, x: 0, y: 0 },
          { isMoveTo: false, x: 10, y: 10 },
        ],
      })

      const result = applyTransformToVectorPath(path, {
        translate: { x: 10, y: 10 },
        rotate: 0,
        scale: { x: 1, y: 1 },
      })

      expect(result.points).toEqual([
        { isMoveTo: true, x: 10, y: 10 },
        { isMoveTo: false, x: 20, y: 20 },
      ])
    })

    it('rotate 90deg', () => {
      const path = createVectorPath({
        points: [
          { isMoveTo: true, x: 0, y: 0 },
          { x: 99.28, y: 99.28 },
        ],
      })

      const result = applyTransformToVectorPath(path, {
        translate: { x: 0, y: 0 },
        rotate: 20,
        scale: { x: 1, y: 1 },
      })

      expect(result.points).toEqual([
        { isMoveTo: true, x: 0, y: 0 },
        { isMoveTo: false, x: 127.24, y: 59.33 },
      ])
    })
  })
})
