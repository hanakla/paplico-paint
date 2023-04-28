import { SVGDCommand } from '@/fastsvg/IndexedPointAtLength'
import { splitPath } from './splitPath'

describe('splitPath', () => {
  it('works?', () => {
    const path: SVGDCommand[] = [['M', 0, 0], ['L', 10, 0], ['Z']]

    console.log(splitPath(path, 5))
    expect(splitPath(path, 5)).toMatchObject([
      [['M', 0, 0], ['L', 5, 0], ['Z']],
      [['M', 5, 0], ['L', 10, 0], ['Z']],
    ])
  })

  describe('GPT genarated cases', () => {
    it('splitPath splits straight line path correctly', () => {
      const path = [
        ['M', 0, 0],
        ['L', 10, 0],
      ]
      const [path1, path2] = splitPath(path, 5)
      expect(path1).toMatchObject([
        ['M', 0, 0],
        ['L', 5, 0],
      ])
      expect(path2).toMatchObject([
        ['M', 5, 0],
        ['L', 10, 0],
      ])
    })

    it('splitPath splits curved path correctly', () => {
      const path = [
        ['M', 0, 0],
        ['C', 3, 3, 6, 3, 9, 0],
      ]
      const [path1, path2] = splitPath(path, 8.5)

      expect(path1).toMatchInlineSnapshot(`
        [
          [
            "M",
            0,
            0,
          ],
          [
            "C",
            1.0483213739447483,
            1.0483213739447483,
            2.0966427478894967,
            1.7303168468663617,
            3.1449641218342452,
            2.04598641876484,
          ],
        ]
      `)
      expect(path2).toMatchInlineSnapshot(`
        [
          [
            "C",
            5.096642747889497,
            2.633674098976865,
            7.048321373944749,
            1.9516786260552517,
            9,
            0,
          ],
        ]
      `)
    })

    it('splitPath handles M command correctly', () => {
      const path = [
        ['M', 0, 0],
        ['L', 10, 0],
        ['M', 10, 10],
        ['L', 20, 10],
      ]
      const [path1, path2] = splitPath(path, 5)
      expect(path1).toMatchInlineSnapshot(`
        [
          [
            "M",
            0,
            0,
          ],
          [
            "L",
            5,
            0,
          ],
          [
            "M",
            10,
            10,
          ],
          [
            "L",
            5,
            10,
          ],
        ]
      `)
      expect(path2).toMatchInlineSnapshot(`
        [
          [
            "M",
            5,
            0,
          ],
          [
            "L",
            10,
            0,
          ],
          [
            "M",
            5,
            10,
          ],
          [
            "L",
            20,
            10,
          ],
        ]
      `)
    })

    it('splitPath handles Z command correctly', () => {
      const path = [
        ['M', 0, 0],
        ['L', 10, 0],
        ['L', 10, 10],
        ['L', 0, 10],
        ['Z'],
      ]
      const [path1, path2] = splitPath(path, 15)
      expect(path1).toMatchInlineSnapshot(`
        [
          [
            "M",
            0,
            0,
          ],
          [
            "L",
            10,
            0,
          ],
          [
            "L",
            3.5355339059327373,
            3.5355339059327373,
          ],
          [
            "L",
            19.14213562373095,
            10,
          ],
          [
            "Z",
          ],
        ]
      `)
      expect(path2).toMatchInlineSnapshot(`
        [
          [
            "M",
            3.5355339059327373,
            3.5355339059327373,
          ],
          [
            "L",
            10,
            10,
          ],
          [
            "M",
            19.14213562373095,
            10,
          ],
          [
            "L",
            0,
            10,
          ],
          [
            "Z",
          ],
        ]
      `)
    })
  })
})
