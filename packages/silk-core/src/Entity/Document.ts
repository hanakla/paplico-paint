import { IRenderable } from './IRenderable'

export class Document {
  public width: number
  public height: number

  public layers: IRenderable[] = []

  constructor({ width, height }: { width: number; height: number }) {
    this.width = width
    this.height = height
  }
}
