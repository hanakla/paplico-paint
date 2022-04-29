import { useStore } from '@fleur/react'
import { useMemo, useState } from 'react'
import { createEditor, Descendant } from 'slate'
import { Editable, Slate, withReact } from 'slate-react'
import { EditorSelector } from '🙌/domains/EditorStable'

export const TextLayerControl = ({}) => {
  const currentLayerBBox = useStore((get) =>
    EditorSelector.activeLayerBBox(get)
  )

  const editor = useMemo(() => withReact(createEditor()), [])
  // Add the initial value when setting up our state.
  const [value, setValue] = useState<Descendant[]>([
    {
      type: 'paragraph',
      children: [{ text: 'A line of text in a paragraph.' }],
    },
  ])

  const bbox = currentLayerBBox ?? null

  return (
    <div
      css={`
        position: absolute;
        left: 0;
        top: 0;
        z-index: 1000;
      `}
      style={{
        left: bbox?.x,
        top: bbox?.y,
      }}
    >
      <Slate
        editor={editor}
        value={value}
        onChange={(newValue) => setValue(newValue)}
      >
        <Editable />
      </Slate>
    </div>
  )
}
