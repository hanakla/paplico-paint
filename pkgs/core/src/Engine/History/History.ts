import { ICommand } from './ICommand'
import { Emitter } from '@paplico/shared-lib'
import { rescue, throwLaterIfFailure } from '@/utils/rescue'
import { DocumentContext } from '@/Engine/DocumentContext/DocumentContext'
import { AtomicResource } from '@/utils/AtomicResource'

export namespace History {
  export type Events = {
    undo: { command: ICommand }
    redo: { command: ICommand }
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

  public async do(document: DocumentContext, command: ICommand) {
    const lock = await this.excutionLock.ensure()

    try {
      await command.do(document)

      this.#undoStack.push(command)
      this.#redoStack = []

      throwLaterIfFailure([
        rescue(() =>
          this.emit('affect', { layerIds: command.effectedVisuUids }),
        ),
      ])
    } finally {
      this.excutionLock.release(lock)
    }
  }

  public async undo(document: DocumentContext) {
    const command = this.#undoStack.pop()
    if (!command) return

    const lock = await this.excutionLock.ensure()

    try {
      await command.undo(document)
      this.#redoStack.push(command)

      throwLaterIfFailure(
        [
          rescue(() =>
            this.emit('affect', { layerIds: command.effectedVisuUids }),
          ),
          rescue(() => this.emit('undo', { command })),
        ],
        'Undo errors',
        true,
      )
    } finally {
      this.excutionLock.release(lock)
    }
  }

  public async redo(document: DocumentContext) {
    const command = this.#redoStack.pop()
    if (!command) return

    const lock = await this.excutionLock.ensure()

    try {
      await command.redo(document)
      this.#undoStack.push(command)

      throwLaterIfFailure(
        [
          rescue(() =>
            this.emit('affect', { layerIds: command.effectedVisuUids }),
          ),
          rescue(() => this.emit('redo', { command })),
        ],
        'Redo errors',
        true,
      )
    } finally {
      this.excutionLock.release(lock)
    }
  }
}
