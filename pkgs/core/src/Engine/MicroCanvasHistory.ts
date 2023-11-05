import { VectorPath } from '@/Document'
import Paplico from '..'

type StrokeComposition = 'normal' | 'erase'

/** WIP: currently not used */
export class MicroCanvasHistory {
  public undoStack: {
    options: Required<Paplico.RenderPathIntoOptions>
    path: VectorPath
  }[] = []
  public redoStack: {
    options: Required<Paplico.RenderPathIntoOptions>
    path: VectorPath
  }[] = []

  public add(
    path: VectorPath,
    options: Required<Paplico.RenderPathIntoOptions>,
  ) {
    this.undoStack.push({ path, options })
    this.redoStack = []
  }

  public undo() {
    const last = this.undoStack.pop()
    if (!last) return

    this.redoStack.push(last)
  }
}
