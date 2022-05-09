import { CommandConstructor, ICommand } from './ICommand'

export type CommandHookEvent = {
  runBy: 'do' | 'undo' | 'redo'
  command: ICommand
}

export type CommandHook = (e: CommandHookEvent) => void

export class CommandHooks {
  protected hooks = new Map<CommandConstructor, CommandHook[]>()

  public on(command: CommandConstructor, hook: CommandHook) {
    const hooks = this.hooks.get(command) ?? []
    this.hooks.set(command, hooks)
    hooks.push(hook)
  }

  public off(command: CommandConstructor, hook: CommandHook) {
    const hooks = this.hooks.get(command) ?? []
    const next = hooks.filter((h) => h !== hook)
    this.hooks.set(command, next)
  }

  public emit(com: ICommand) {
    const command = com.constructor as CommandConstructor
    this.hooks.get(command)?.forEach((hook) => hook(com))
  }
}
