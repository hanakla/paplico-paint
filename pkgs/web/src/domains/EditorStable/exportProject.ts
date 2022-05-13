import { StoreGetter } from '@fleur/fleur'
import { PapDOM, PapSerializer } from '@paplico/core'
import { ColorHistoryEntry, EditorSelector } from '../EditorStable'

// export const importProjectWithEditorMeta =(document: Document, )

export type ExtraData = {
  colorHistory: ColorHistoryEntry[]
}

export const extractEditorMeta = (
  extra: { PAPLICO_EDITOR: ExtraData } | undefined | null
): ExtraData => {
  const meta = extra?.PAPLICO_EDITOR ?? ({} as any)

  return {
    colorHistory: meta.colorHistory ?? [],
  }
}

export const exportProject = (
  document: PapDOM.Document,
  getStore: StoreGetter
) => {
  const extra = {
    PAPLICO_EDITOR: {
      colorHistory: EditorSelector.colorHistory(getStore).map(
        (entry, i, list) => ({
          color: entry.color,
          lastUsedAt: list.length - i,
        })
      ),
    },
  }
  const bin = PapSerializer.exportDocument(document, extra)
  const blob = new Blob([bin], { type: 'application/octet-stream' })

  return { blob, buffer: bin.buffer }
}
