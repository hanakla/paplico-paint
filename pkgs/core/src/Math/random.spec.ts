// import { PCG } from 'random-seedable'
import { papRandomInt, papRandomFloat } from './random'

describe('papRandomInt', () => {
  // it('is match to original?', () => {
  //   const pcg = new PCG(12345n)
  //   pcg.int()

  //   const expects = Array(100)
  //     .fill(0)
  //     .map(() => pcg.int())

  //   console.log(expects)

  //   const result = Array(100)
  //     .fill(0)
  //     .map((_, i) => papRandomInt(12345n, i))
  //   console.log(result)
  // })

  function generateUniq(length: number, baseSeed: number) {
    return [
      ...new Set<number>(
        Array.from({ length }, (_, idx) => papRandomInt(baseSeed, idx)),
      ),
    ]
  }

  function generateUniqFloat(length: number, baseSeed: number) {
    return [
      ...new Set<number>(
        Array.from({ length }, (_, idx) => papRandomFloat(baseSeed, idx)),
      ),
    ]
  }

  describe('papRandom', () => {
    it.only('benchmark', () => {
      const counts = 5000
      const start = Date.now()
      const results = generateUniq(counts, 0)
      const end = Date.now()
      const per = (end - start) / counts
      console.log(
        `papRandomInt: ${counts} times: ${end - start}ms (${per}ms/1)`,
      )
    })

    // it.only.each([[0], [0x7fa0ea25], [Math.random() * 10000], [-43210]])(
    //   'should return a unique random number',
    //   (seed) => {
    //     const results = generateUniq(1000, seed)

    //     expect(results.length).toBeGreaterThanOrEqual(19500)
    //   },
    // )

    // it('should return different numbers for different seed', () => {
    //   const results1 = generateUniq(10000, 0).sort()
    //   const results2 = generateUniq(10000, 1234569).sort()
    //   const results3 = generateUniq(10000, 0xf874a3a).sort()

    //   expect(results1).not.toEqual(results2)
    //   expect(results2).not.toEqual(results3)
    //   expect(results3).not.toEqual(results1)
    // })

    // it('should return max value', () => {
    //   const results = [
    //     ...generateUniq(100000, 0),
    //     // ...generateUniqFloat(10000, 1234569),
    //     // ...generateUniqFloat(10000, 0xf874a3a),
    //   ]

    //   const max = Math.max(...results)
    //   expect(max).toBe(2 ** 36)
    // })

    // it('should not return over 2^36', () => {
    //   const results = generateUniq(10000, 0)
    //   const max = Math.max(...results)
    //   expect(max).toBeLessThan(2 ** 36)
    // })

    // it('should returns positive numbers', () => {
    //   const results = generateUniq(10000, 0)
    //   expect(results.every((v) => v >= 0)).toBe(true)
    // })
  })

  // describe('papRandomFloat', () => {
  //   it.each([[0], [0x7fa0ea25], [Math.random() * 10000], [-43210]])(
  //     'should return a unique random number',
  //     (seed) => {
  //       const results = generateUniqFloat(20000, seed)
  //       expect(results.length).toBeGreaterThanOrEqual(19500)
  //     },
  //   )

  //   it('should not return over 1', () => {
  //     const results = generateUniqFloat(10000, 0)
  //     const max = Math.max(...results)
  //     expect(max).toBeLessThan(1)
  //   })

  //   it('should return 1', () => {
  //     const results = [
  //       ...generateUniqFloat(400000, 10),
  //       // ...generateUniqFloat(10000, 1234569),
  //       // ...generateUniqFloat(10000, 0xf874a3a),
  //     ]

  //     const max = Math.max(...results)
  //     expect(max).toBe(1)
  //   })

  //   it('should not return under 0', () => {
  //     const results = generateUniqFloat(10000, 0)
  //     const min = Math.min(...results)
  //     expect(min).toBeGreaterThanOrEqual(0)
  //   })
  // })
})
