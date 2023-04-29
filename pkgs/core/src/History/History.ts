import { ICommand } from './ICommand'
import { Emitter } from '@/utils/Emitter'
import { rescue } from '@/utils/resque'
import { RuntimeDocument } from '@/Engine/RuntimeDocument'
import { AtomicResource } from '@/utils/AtomicResource'

type Events = {
  affect: { layerIds: string[] }
}

export class History extends Emitter<Events> {
  protected excutionLock = new AtomicResource({})

  protected undoStack: ICommand[] = []
  protected redoStack: ICommand[] = []

  public async do(document: RuntimeDocument, command: ICommand) {
    const lock = await this.excutionLock.ensure()

    try {
      await command.do(document)
      rescue(() => this.emit('affect', { layerIds: command.effectedLayers }))

      this.undoStack.push(command)
      this.redoStack = []
    } finally {
      this.excutionLock.release(lock)
    }
  }

  public async undo(document: RuntimeDocument) {
    const command = this.undoStack.pop()
    if (!command) return

    const lock = await this.excutionLock.ensure()

    try {
      await command.undo(document)
      rescue(() => this.emit('affect', { layerIds: command.effectedLayers }))
      this.redoStack.push(command)
    } finally {
      this.excutionLock.release(lock)
    }
  }

  public async redo(document: RuntimeDocument) {
    const command = this.redoStack.pop()
    if (!command) return

    const lock = await this.excutionLock.ensure()

    try {
      await command.redo(document)
      rescue(() => this.emit('affect', { layerIds: command.effectedLayers }))
      this.undoStack.push(command)
    } finally {
      this.excutionLock.release(lock)
    }
  }
}
