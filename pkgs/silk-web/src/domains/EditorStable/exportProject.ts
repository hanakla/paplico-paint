import { StoreGetter } from '@fleur/fleur'
import { SilkDOM, SilkSerializer } from 'silk-core'

export const exportProject = (
  document: SilkDOM.Document,
  getStore: StoreGetter
) => {
  const extra = { SILK_EDITOR: {} }
  const bin = SilkSerializer.exportDocument(document, extra)
  const blob = new Blob([bin], { type: 'application/octet-stream' })

  return { blob, buffer: bin.buffer }
}
