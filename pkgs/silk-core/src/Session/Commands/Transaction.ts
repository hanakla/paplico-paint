import { Document } from '../../SilkDOM'
import { ICommand } from '../ICommand'

export class Transaction implements ICommand {
  public readonly name = 'Transaction'

  private commands: ICommand[]
  private document!: Document

  constructor({ commands }: { commands: ICommand[] }) {
    this.commands = commands
  }

  public doAndAddCommand(command: ICommand) {
    command.do(this.document)
    this.commands.push(command)
  }

  async do(document: Document) {
    // for (const cmd of this.commands) await cmd.do(document)
    this.document = document
  }

  async undo(document: Document): Promise<void> {
    const reverse = [...this.commands].reverse()
    for (const cmd of reverse) await cmd.undo(document)
  }

  async redo(document: Document): Promise<void> {
    for (const cmd of this.commands) await cmd.do(document)
  }

  get effectedLayers(): string[][] {
    return this.commands.map((c) => c.effectedLayers).flat(1)
  }
}
