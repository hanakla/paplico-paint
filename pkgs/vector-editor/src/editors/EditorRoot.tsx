import { useEngineStore } from '@/store'
import { VectorEditor } from './VectorEditor'
import { memo, useMemo } from 'react'
import { themeVariables } from '@/theme'
import { createUseStyles } from 'react-jss'

type Props = {
  theme?: typeof themeVariables
}

export const EditorRoot = memo(function EditorRoot({
  theme = themeVariables,
}: Props) {
  const { paplico } = useEngineStore()

  const useStyles = useMemo(() => {
    return createUseStyles({
      styleRoot: {
        '&:root': {
          ...theme,
        },
      },
    })
  }, [theme])

  const s = useStyles()

  const mainArtboard = useMemo(
    () => paplico.currentDocument?.meta.mainArtboard,
    [paplico.currentDocument?.meta.mainArtboard],
  )

  const size = useMemo(
    () => ({
      width: mainArtboard?.width ?? 0,
      height: mainArtboard?.height ?? 0,
    }),
    [paplico.currentDocument?.uid],
  )

  return (
    <svg
      width={size.width}
      height={size.height}
      viewBox={`0 0 ${size.width} ${size.height}`}
      style={{ pointerEvents: 'none' }}
      tabIndex={-1}
      className={s.styleRoot}
    >
      <VectorEditor width={size.width} height={size.height} />
    </svg>
  )
})
