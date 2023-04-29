import { PaplicoDocument } from '@/Document'
import { ICommand } from './ICommand'
import { Emitter } from '@/utils/Emitter'
import { rescue } from '@/utils/resque'

type Events = {
  affect: { layerIds: string[] }
}

export class History extends Emitter<Events> {
  protected undoStack: ICommand[] = []
  protected redoStack: ICommand[] = []

  public async do(command: ICommand, document: PaplicoDocument) {
    await command.do(document)
    rescue(() => this.emit('affect', { layerIds: command.effectedLayers }))
    this.undoStack.push(command)
    this.redoStack = []
  }

  public async undo(document: PaplicoDocument) {
    const command = this.undoStack.pop()

    if (!command) return

    await command.undo(document)
    rescue(() => this.emit('affect', { layerIds: command.effectedLayers }))
    this.redoStack.push(command)
  }

  public async redo(document: PaplicoDocument) {
    const command = this.redoStack.pop()

    if (!command) return

    await command.redo(document)
    rescue(() => this.emit('affect', { layerIds: command.effectedLayers }))
    this.undoStack.push(command)
  }
}
