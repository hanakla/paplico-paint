import { useStore } from '@fleur/react'
import { EditorSelector } from '🙌/domains/EditorStable'

export const RasterLayerControl = () => {
  const { session, currentDocument } = useStore((get) => ({
    session: EditorSelector.currentSession(get),
    currentDocument: EditorSelector.currentDocument(get),
  }))

  const bbox = session?.currentLayerBBox ?? null

  if (!bbox || !currentDocument) return null

  return (
    <>
      <rect
        css={`
          fill: none;
          stroke: #0ff;
        `}
        x={bbox.x}
        y={bbox.y}
        width={bbox?.width}
        height={bbox?.height}
      />
    </>
  )
}
