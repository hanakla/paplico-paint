import { Document, LayerTypes } from 'SilkDOM'
import { ICommand } from '../ICommand'

export class DocumentAddLayer implements ICommand {
  private layer: LayerTypes
  private aboveOnLayerId: string | null | undefined

  constructor({
    layer,
    aboveOnLayerId,
  }: {
    layer: LayerTypes
    aboveOnLayerId?: string | null
  }) {
    this.layer = layer
    this.aboveOnLayerId = aboveOnLayerId
  }

  async do(document: Document): Promise<void> {
    document.addLayer(this.layer, { aboveLayerId: this.aboveOnLayerId })
  }

  async undo(document: Document): Promise<void> {
    const idx = document.layers.findIndex((l) => l.uid === this.layer.uid)
    if (idx === -1) return
    document.update((d) => d.layers.splice(idx, 1))
  }

  async redo(document: Document): Promise<void> {
    document.addLayer(this.layer, { aboveLayerId: this.aboveOnLayerId })
  }
}
