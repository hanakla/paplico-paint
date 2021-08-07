import { useMemo } from 'react'
import { useUpdate } from 'react-use'
import { useSilkEngine } from './useSilkEngine'

export const useEditorControls = () => {
  const engine = useSilkEngine()
  const rerender = useUpdate()

  return useMemo(
    () => ({
      rerenderCanvas: () => {},
    }),
    [engine]
  )
}
