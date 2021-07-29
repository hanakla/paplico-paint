import { Document } from '../Entity/Document'

export class SilkEngine {
  protected canvas: HTMLCanvasElement
  protected context: CanvasRenderingContext2D
  protected document: Document

  constructor({ canvas }: { canvas: HTMLCanvasElement }) {
    this.canvas = canvas
    this.context = canvas.getContext('2d')
  }

  public async setDocument(document: Document) {
    this.document = document

    this.canvas.width = document.width
    this.canvas.height = document.height
  }
}
