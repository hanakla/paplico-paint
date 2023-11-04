import { createVectorObject } from '@/Document'
import { vectorObjectTransformToMatrix } from './VectorUtils'
import DOMMatrix from '@thednp/dommatrix'

describe('DOMMatrix', () => {
  // broke this test by DOMMatrix internals references native DOMMatrix directly
  it.skip('test', () => {
    const matrix = vectorObjectTransformToMatrix(
      createVectorObject({
        transform: {
          position: { x: 1, y: 2 },
          scale: { x: 3, y: 4 },
          rotate: 5,
        },
        path: {
          fillRule: 'nonzero',
          points: [{ isMoveTo: true, x: 0, y: 0, begin: null, end: null }],
          randomSeed: 0,
        },
      }),
    )

    expect(matrix).toMatchObject(new DOMMatrix(matrix).toFloat64Array())
  })
})
