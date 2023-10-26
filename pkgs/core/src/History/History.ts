import { ICommand } from './ICommand'
import { Emitter } from '@/utils/Emitter'
import { rescue } from '@/utils/resque'
import { RuntimeDocument } from '@/Engine/RuntimeDocument'
import { AtomicResource } from '@/utils/AtomicResource'

export namespace History {
  export type Events = {
    affect: { layerIds: string[] }
  }
}

export class History extends Emitter<History.Events> {
  protected excutionLock = new AtomicResource({})

  #undoStack: ICommand[] = []
  #redoStack: ICommand[] = []

  public dispose() {
    this.excutionLock.clearQueue()
    this.mitt.all.clear()

    this.#undoStack.forEach((c) => c.dispose?.())
    this.#redoStack.forEach((c) => c.dispose?.())

    this.#undoStack = []
    this.#redoStack = []
  }

  public get undoStack() {
    return [...this.#undoStack]
  }

  public get redoStack() {
    return [...this.#redoStack]
  }

  public canUndo() {
    return this.#undoStack.length > 0
  }

  public canRedo() {
    return this.#redoStack.length > 0
  }

  public async do(document: RuntimeDocument, command: ICommand) {
    const lock = await this.excutionLock.ensure()

    try {
      await command.do(document)
      rescue(() => this.emit('affect', { layerIds: command.effectedLayers }))

      this.#undoStack.push(command)
      this.#redoStack = []
    } finally {
      this.excutionLock.release(lock)
    }
  }

  public async undo(document: RuntimeDocument) {
    const command = this.#undoStack.pop()
    if (!command) return

    const lock = await this.excutionLock.ensure()

    try {
      await command.undo(document)
      rescue(() => this.emit('affect', { layerIds: command.effectedLayers }))
      this.#redoStack.push(command)
    } finally {
      this.excutionLock.release(lock)
    }
  }

  public async redo(document: RuntimeDocument) {
    const command = this.#redoStack.pop()
    if (!command) return

    const lock = await this.excutionLock.ensure()

    try {
      await command.redo(document)
      rescue(() => this.emit('affect', { layerIds: command.effectedLayers }))
      this.#undoStack.push(command)
    } finally {
      this.excutionLock.release(lock)
    }
  }
}
