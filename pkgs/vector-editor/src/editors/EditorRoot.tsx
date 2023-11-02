import { useEditorStore, useEngineStore } from '@/store'
import { VectorEditor } from './VectorEditor'
import { memo, useEffect, useMemo, useRef } from 'react'
import { themeVariables } from '@/theme'
import { createUseStyles } from 'react-jss'
import useMeasure from 'react-use-measure'
import { storePicker } from '@/utils/zutrand'
import { MetricsView } from './MetricsView'
import { TextEditor } from './TextEditor'

type Props = {
  theme?: typeof themeVariables
}

export const EditorRoot = memo(function EditorRoot({
  theme = themeVariables,
}: Props) {
  const { paplico } = useEngineStore()
  const { brushSizePreview, setEditorState, currentType } = useEditorStore(
    storePicker(['brushSizePreview', 'setEditorState', 'currentType']),
  )
  const s = useStyles()

  // const rootRef = useRef<SVGSVGElement | null>(null)
  const [rootRef, bound] = useMeasure({ offsetSize: true })

  const useGlobalStyles = useMemo(() => {
    return createUseStyles({
      styleRoot: {
        ...theme,
      },
    })
  }, [theme])

  const globalStyles = useGlobalStyles()

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

  const brushSizePreviewRef = useRef<SVGCircleElement>(null)
  const animationName = useRef<string>('')

  useEffect(() => {
    const circle = brushSizePreviewRef.current
    if (!circle) return

    if (!animationName.current) {
      animationName.current = getComputedStyle(circle).animationName
    }

    circle.setAttribute('r', `${brushSizePreview?.size ?? 0}`)

    Object.assign(circle.style, {
      animationName: 'none',
      animationDuration: `${brushSizePreview?.durationMs ?? 100}ms`,
      animationFillMode: 'backwards',
    })

    void circle.clientWidth

    requestAnimationFrame(() => {
      Object.assign(circle.style, {
        animationName: animationName.current,
        animationFillMode: 'forwards',
      })
    })
  }, [brushSizePreview])

  useEffect(() => {
    setEditorState({
      _rootBBox: bound,
    })
  }, [bound])

  return (
    <svg
      ref={rootRef}
      width={size.width}
      height={size.height}
      viewBox={`0 0 ${size.width} ${size.height}`}
      style={{ pointerEvents: 'none' }}
      tabIndex={-1}
      className={globalStyles.styleRoot}
    >
      <circle
        ref={brushSizePreviewRef}
        className={s.brushSize}
        cx={size.width / 2}
        cy={size.height / 2}
        r={brushSizePreview?.size ?? 0}
      />
      {/* <MetricsView width={size.width} height={size.height} /> */}
      {currentType === 'vector' && (
        <VectorEditor
          rootBBox={bound}
          width={size.width}
          height={size.height}
        />
      )}
      {currentType === 'text' && (
        <TextEditor width={size.width} height={size.height} />
      )}
    </svg>
  )
})

const useStyles = createUseStyles({
  '@keyframes brushSizePreviewFadeOut': {
    from: {
      opacity: 1,
    },
    to: {
      opacity: 0,
    },
  },
  brushSize: {
    // pointerEvents: 'none',
    fill: 'none',
    stroke: 'var(--pap-ui-color)',
    animationName: '$brushSizePreviewFadeOut',
    animationTimingFunction: 'ease-in',
  },
})