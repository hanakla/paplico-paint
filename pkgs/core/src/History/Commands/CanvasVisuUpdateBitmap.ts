import { ICommand } from '../ICommand'
import { DocumentContext } from '@/Engine'
import {
  PPLCInvalidOptionOrStateError,
  PPLCInvariantViolationError,
} from '@/Errors'

type Options = { updater: (bitmap: Uint8ClampedArray) => void }

export class CanvasVisuUpdateBitmap implements ICommand {
  public readonly name = 'CanvasVisuUpdateBitmap'

  protected visuUid: string
  protected options: Options

  protected previous: Uint8Array | null = null
  protected updated: Uint8Array | null = null

  constructor(targetVisuUid: string, options: Options) {
    this.visuUid = targetVisuUid
    this.options = options
  }

  public async do(docx: DocumentContext): Promise<void> {
    const visu = docx.document.getVisuByUid(this.visuUid)
    if (!visu)
      throw new PPLCInvalidOptionOrStateError(
        `CanvasVisuUpdateBitmap: Target Visu not found ${this.visuUid}`,
      )
    if (visu.type !== 'canvas') return

    this.previous = new Uint8Array(visu.bitmap)
    this.options.updater(visu.bitmap)
    this.updated = new Uint8Array(visu.bitmap)
    docx.invalidateLayerBitmapCache(this.visuUid)
  }

  public async undo(docx: DocumentContext): Promise<void> {
    const visu = docx.document.getVisuByUid(this.visuUid)
    if (!visu) {
      throw new PPLCInvariantViolationError(
        `CanvasVisuUpdateBitmap: Target Visu not found in undoing ${this.visuUid}`,
      )
    }

    if (visu.type !== 'canvas') return
    if (!this.previous) return

    visu.bitmap.set(this.previous)
    docx.invalidateLayerBitmapCache(this.visuUid)
  }

  public async redo(docx: DocumentContext): Promise<void> {
    const visu = docx.document.getVisuByUid(this.visuUid)
    if (!visu) {
      throw new PPLCInvariantViolationError(
        `CanvasVisuUpdateBitmap: Target Visu not found in redoing ${this.visuUid}`,
      )
    }

    if (visu.type !== 'canvas') return
    if (!this.updated) return

    visu.bitmap.set(this.updated)
    docx.invalidateLayerBitmapCache(this.visuUid)
  }

  get effectedVisuUids() {
    return [this.visuUid]
  }
}
