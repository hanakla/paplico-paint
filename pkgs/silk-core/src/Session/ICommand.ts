import { Document } from '../SilkDOM'

export interface ICommand {
  do(document: Document): Promise<void>
  undo(document: Document): Promise<void>
  redo(document: Document): Promise<void>
}
