import { GetServerSideProps } from 'next'
import styled from 'styled-components'

import { Button } from '🙌/components/Button'
import { Stack } from '🙌/components/Stack'
import { DevLayout } from '🙌/layouts/DevLayout'

export default function Debug() {
  return (
    <DevLayout>
      <Stack
        css={`
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          padding: 8px;
        `}
        dir="vertical"
      >
        <ItemButton
          kind="normal"
          onClick={() => {
            benchCase({
              name: 'putImageData vs drawImage',
              init: async () => {
                const imageData = new ImageData(1000, 1000)
                const canvas = document.createElement('canvas')
                canvas.width = imageData.width
                canvas.height = imageData.height

                return {
                  ctx: canvas.getContext('2d')!,
                  data: imageData,
                  bitmap: await createImageBitmap(imageData),
                }
              },
              cases: [
                {
                  name: 'putImageData',
                  run: ({ ctx, data }) => {
                    ctx.putImageData(data, 0, 0)
                  },
                },
                {
                  name: 'drawImage',
                  run: ({ ctx, bitmap }) => {
                    ctx.drawImage(bitmap, 0, 0)
                  },
                },
              ],
              iterate: 1000,
            }).run()
          }}
        >
          putImageData vs drawImage
        </ItemButton>

        <ItemButton
          onClick={() => {
            benchCase({
              name: 'createImageBitmap',
              init: async () => {
                const imageData = new ImageData(1000, 1000)
                return { imageData }
              },
              cases: [
                {
                  name: 'test',
                  run: async ({ imageData }) => {
                    await createImageBitmap(imageData)
                  },
                },
              ],
              iterate: 1000,
            }).run()
          }}
        >
          createImageBitmap
        </ItemButton>
      </Stack>
    </DevLayout>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  return {
    props: {},
    notFound: process.env.NODE_ENV !== 'production' ? false : true,
  }
}

const ItemButton = styled(Button)`
  width: 100px;
  height: 100px; ;
`

const benchCase = function <Init>(opt: {
  name: string
  init: () => Init | Promise<Init>
  cases: { name: string; run: (init: Init) => void | Promise<void> }[]
  // case1: (init: Init) => void | Promise<void>
  // case2?: (init: Init) => void | Promise<void>
  iterate: number
}) {
  return {
    run: async () => {
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
        console.groupEnd()

        console.groupEnd()
      }

      console.groupEnd()
    },
  }
}
