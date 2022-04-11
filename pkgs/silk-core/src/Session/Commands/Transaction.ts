import { Document } from '../../SilkDOM'
import { ICommand } from '../ICommand'

export class Transaction implements ICommand {
  private commands: ICommand[]

  constructor({ commands }: { commands: ICommand[] }) {
    this.commands = commands
  }

  async do(document: Document) {
    for (const cmd of this.commands) await cmd.do(document)
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
