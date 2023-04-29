import { RuntimeDocument } from '@/Engine/RuntimeDocument'

export type CommandConstructor = {
  new (...args: any[]): ICommand
}

export interface ICommand {
  readonly name: string

  do(document: RuntimeDocument): Promise<void>
  undo(document: RuntimeDocument): Promise<void>
  redo(document: RuntimeDocument): Promise<void>

  /** Effected layer ids, it using to optimize render performance pre/post execute command */
  readonly effectedLayers: string[]
}
