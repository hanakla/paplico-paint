import { Document, LayerTypes } from '../../DOM'

export class DocumentConnector {
  public type = 'document'

  constructor(protected document: Document) {}

  appendChild(layer: LayerTypes) {
    this.document.layers.push(layer)
  }
}
