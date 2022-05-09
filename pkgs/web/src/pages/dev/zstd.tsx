import { GetServerSideProps } from 'next'
import styled from 'styled-components'

import { Button } from '🙌/components/Button'
import { Stack } from '🙌/components/Stack'
import { DevLayout } from '🙌/layouts/DevLayout'
import { benchCase } from '🙌/features/Debug/benchCase'
import { useEffect } from 'react'
import { useAsyncEffect } from '@hanakla/arma'
import { useEffectOnce } from 'react-use'
import { PapDOM } from '@paplico/core'

export default function Debug() {
  useEffectOnce(() => {
    ;(async () => {
      const { compress, decompress } = await import('brotli-wasm')
      const raster = PapDOM.RasterLayer.create({
        width: 3508,
        height: 2480,
      })

      console.time('compress')

      const compressed = compress(Buffer.from(raster.bitmap))
      const decompressed = decompress(compressed)
      console.timeEnd('compress')
      console.log({ compressed, decompressed })
    })()
  })

  return (
    <DevLayout>
      <></>
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
