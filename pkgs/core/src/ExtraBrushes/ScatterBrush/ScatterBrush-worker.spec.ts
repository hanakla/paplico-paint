import { Matrix4 } from '@/Math'
import { processInput } from './ScatterBrush-worker'
import { indexedPointAtLength } from '@/StrokingHelper'

describe('ScatterBrush-worker', () => {
  it('test', () => {
    const indexed = indexedPointAtLength('M0,0 L10,10')

    const request = [
      0, 0.01, 1, 1.01, 2, 2.01, 3, 3.01, 4, 4.01, 5, 5.01, 6, 6.01, 7, 7.01, 8,
      8.01, 9, 9.01, 10, 10.01, 11, 11.01, 12, 12.01, 13, 13.01, 14, 14.01,
      14.142135623730951,
    ]

    const indexedResult = indexed.atBatch(request).map((p) => p.pos)
    const originalResult = request.map((len) => indexed.at(len))

    expect(indexedResult).toEqual(originalResult)
  })

  it('processInput', async () => {
    const result = await processInput({
      id: 'test',
      type: 'getPoints',
      brushSize: 1,
      destSize: { width: 10, height: 10 },
      inOutInfluence: 0,
      scatterRange: 0,
      scatterScale: 0,
      inOutLength: 0,
      path: {
        randomSeed: 0,
        closed: false,
        points: [
          {
            x: 0,
            y: 0,
            end: null,
            begin: null,
          },
          {
            x: 10,
            y: 10,
            begin: null,
            end: null,
          },
        ],
      },
    })

    result.type === 'getPoints' && console.log(result._internals)

    // expect(result).toMatchSnapshot()
  })
})
