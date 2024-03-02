import { PPLCCommandExecutionError } from '@/Errors'
import { ICommand } from '../Engine/History/ICommand'
import { DocumentContext } from '@/Engine'

export class CommandGroup implements ICommand {
  public readonly name = 'CommandGroup'

  protected commands: ICommand[] = []
  protected docx: DocumentContext | null = null

  constructor(commands: ICommand[]) {
    this.commands = commands
  }

  public async doAndAddCommand(command: ICommand) {
    if (!this.docx) {
      throw new PPLCCommandExecutionError(
        'CommandGroup must be execute before doAndAddCommand',
      )
    }

    await command.do(this.docx)
    this.commands.push(command)
  }

  public async do(docx: DocumentContext): Promise<void> {
    this.docx = docx

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
