import { WebGLContext } from '../engine/WebGLContext'
import { ToolRegistry } from './ToolRegistry'

export class Engine {
  public gl: WebGLContext
  public toolRegistry: ToolRegistry

  constructor({
    toolRegistry = new ToolRegistry(),
  }: {
    toolRegistry: ToolRegistry
  }) {
    this.gl = new WebGLContext()
    this.toolRegistry = toolRegistry
  }
}
