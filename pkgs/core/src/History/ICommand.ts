import { PaplicoDocument } from '../Document/Document'

export type CommandConstructor = {
  new (...args: any[]): ICommand
}

export interface ICommand {
  readonly name: string

  do(document: PaplicoDocument): Promise<void>
  undo(document: PaplicoDocument): Promise<void>
  redo(document: PaplicoDocument): Promise<void>

  /** Effected layer ids, it using to optimize render performance pre/post execute command */
  readonly effectedLayers: string[]
}
