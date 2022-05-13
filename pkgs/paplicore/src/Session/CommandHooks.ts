import { CommandConstructor, ICommand } from './ICommand'

export type CommandHookEvent = {
  runBy: 'do' | 'undo' | 'redo' | 'revert'
  command: ICommand
}

export type CommandHook = (e: CommandHookEvent) => void
export type AllCommandHook = (
  e: { type: CommandConstructor } & CommandHookEvent
) => void

export class CommandHooks {
  protected allHook = new Set<AllCommandHook>()
  protected hooks = new Map<CommandConstructor, CommandHook[]>()

  public on(command: '*', hook: AllCommandHook): void
  public on(command: CommandConstructor, hook: CommandHook): void
  public on(
    command: CommandConstructor | '*',
    hook: CommandHook | AllCommandHook
  ) {
    if (command === '*') {
      this.allHook.add(hook)
      return
    }

    const hooks = this.hooks.get(command) ?? []
    this.hooks.set(command, hooks)
    hooks.push(hook as CommandHook)
  }

  public off(command: '*', hook: AllCommandHook): void
  public off(command: CommandConstructor, hook: CommandHook): void
  public off(
    command: CommandConstructor | '*',
    hook: CommandHook | AllCommandHook
  ) {
    if (command === '*') {
      this.allHook.delete(hook)
      return
    }

    const hooks = this.hooks.get(command) ?? []
    const next = hooks.filter((h) => h !== hook)
    this.hooks.set(command, next)
  }

  public emit(cmd: ICommand, detail: Omit<CommandHookEvent, 'command'>) {
    const command = cmd.constructor as CommandConstructor

    this.allHook.forEach((hook) =>
      hook({ ...detail, command: cmd, type: command })
    )
    this.hooks
      .get(command)
      ?.forEach((hook) => hook({ command: cmd, ...detail }))
  }
}
