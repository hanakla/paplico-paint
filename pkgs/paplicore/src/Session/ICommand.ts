import { Document } from '../DOM'

export interface ICommand {
  readonly name: string

  do(document: Document): Promise<void>
  undo(document: Document): Promise<void>
  redo(document: Document): Promise<void>
  readonly effectedLayers: string[][]
}
