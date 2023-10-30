import { DocumentContext } from '@/Engine/DocumentContext/DocumentContext'

export type CommandConstructor = {
  new (...args: any[]): ICommand
}

export interface ICommand {
  readonly name: string

  dispose?(): void

  do(document: DocumentContext): Promise<void>
  undo(document: DocumentContext): Promise<void>
  redo(document: DocumentContext): Promise<void>

  /** Effected layer ids, it using to optimize render performance pre/post execute command */
  readonly effectedLayers: string[]
}
