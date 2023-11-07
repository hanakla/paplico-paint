import { ICommand } from '../Engine/History/ICommand'
import { DocumentContext } from '@/Engine'

export class CommandGroup implements ICommand {
  public readonly name = 'CommandGroup'

  protected commands: ICommand[] = []

  constructor(commands: ICommand[]) {
    this.commands = commands
  }

  public async do(docx: DocumentContext): Promise<void> {
    for (const command of this.commands) {
      await command.do(docx)
    }
  }

  public async undo(document: DocumentContext): Promise<void> {
    for (const command of this.commands) {
      await command.undo(document)
    }
  }

  public async redo(document: DocumentContext): Promise<void> {
    for (const command of this.commands) {
      await command.redo(document)
    }
  }

  get effectedVisuUids() {
    const effected = new Set<string>()
    this.commands.forEach((command) => {
      command.effectedVisuUids.forEach((uid) => effected.add(uid))
    })
    return Array.from(effected)
  }
}
