import { StoreGetter } from '@fleur/fleur'
import { PapDOM, PapSerializer } from '@paplico/core'

export const exportProject = (
  document: PapDOM.Document,
  getStore: StoreGetter
) => {
  const extra = { PAPLICO_EDITOR: {} }
  const bin = PapSerializer.exportDocument(document, extra)
  const blob = new Blob([bin], { type: 'application/octet-stream' })

  return { blob, buffer: bin.buffer }
}
