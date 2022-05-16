import { Document } from '../../DOM'

export class Container {
  public document: Document

  appendChild(document: Document) {
    this.document = document
  }
}
