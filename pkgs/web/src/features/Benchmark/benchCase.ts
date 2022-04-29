export const benchCase = function <Init>(opt: {
  name: string
  init: () => Init | Promise<Init>
  cases: { name: string; run: (init: Init) => void | Promise<void> }[]
  // case1: (init: Init) => void | Promise<void>
  // case2?: (init: Init) => void | Promise<void>
  iterate: number
}) {
  return {
    name: opt.name,
    run: async () => {
      console.clear()

      const init = await opt.init()
      const logThreshold = Math.floor(opt.iterate / 10)

      console.group(opt.name)

      for (const bench of opt.cases) {
        let maxTime = -Infinity
        let minTime = Infinity
        let sumTime = 0

        console.group(`${opt.name} case ${bench.name}`)

        const caseStart = performance.now()
        for (let i = 0; i < opt.iterate; i++) {
          const iterationStart = performance.now()
          if (i % logThreshold === 0) console.log(`Complete ${i} iterations`)
          await bench.run(init)

          const iterationEnd = performance.now()

          sumTime += iterationEnd - iterationStart
          maxTime = Math.max(maxTime, iterationEnd - iterationStart)
          minTime = Math.min(minTime, iterationEnd - iterationStart)
        }
        const caseEnd = performance.now()

        console.log(
          `End ${opt.name} case ${bench.name}: %c${
            caseEnd - caseStart
          }ms%c for ${opt.iterate} iterations`,
          'font-weight: bold',
          ''
        )

        console.group('Details')
        console.log('Average per iteration:', sumTime / opt.iterate)
        console.log('Max time:', maxTime)
        console.log('Min time:', minTime)
        console.log('Op per sec:', Math.round(1000 / (sumTime / opt.iterate)))
        console.groupEnd()

        console.groupEnd()
      }

      console.groupEnd()
    },
  }
}
