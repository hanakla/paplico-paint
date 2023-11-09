import {
  createVectorObjectVisually,
  createVectorPath,
} from '@/Document/Visually/factory'
import { vectorObjectTransformToMatrix } from './VectorUtils'

describe('DOMMatrix', () => {
  // broke this test by DOMMatrix internals references native DOMMatrix directly
  it.skip('test', () => {
    const matrix = vectorObjectTransformToMatrix(
      createVectorObjectVisually({
        transform: {
          position: { x: 1, y: 2 },
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
