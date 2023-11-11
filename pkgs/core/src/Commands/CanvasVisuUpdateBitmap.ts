import { ICommand } from '@/Engine/History/ICommand'
import { DocumentContext } from '@/Engine'
import {
  PPLCOptionInvariantViolationError,
  PPLCInvariantViolationError,
} from '@/Errors'
import { ReadonlyUint8ClampedArray } from '@/Document/Structs'
import {
  compressToGzip,
  decompressFromGzip,
  humanizedBytes,
  promiseWithResolvers,
} from '@paplico/shared-lib'

type Options = {
  updater: (bitmap: ReadonlyUint8ClampedArray) => Uint8ClampedArray
}

export class CanvasVisuUpdateBitmap implements ICommand {
  public readonly name = 'CanvasVisuUpdateBitmap'

  protected visuUid: string
  protected options: Options

  protected previous: Promise<ArrayBufferLike> | null = null
  protected updated: Promise<ArrayBufferLike> | null = null

  constructor(targetVisuUid: string, options: Options) {
    this.visuUid = targetVisuUid
    this.options = options
  }

  public async do(docx: DocumentContext): Promise<void> {
    const visu = docx.document.getVisuByUid(this.visuUid)
    if (!visu)
      throw new PPLCOptionInvariantViolationError(
        `CanvasVisuUpdateBitmap: Target Visu not found ${this.visuUid}`,
      )
    if (visu.type !== 'canvas') return

    const next = this.options.updater(visu.bitmap)
    if (!next || next === (visu.bitmap as any)) {
      throw new PPLCInvariantViolationError(
        'CanvasVisuUpdateBitmap: Updater must not return same Uint8ClampedArray.' +
          'If you want to update bitmap, you must return new Uint8ClampedArray.',
      )
    }
    docx.invalidateLayerBitmapCache(this.visuUid)

    // compress later to avoid blocking main thread or race condition on canvas
    const previousResolver = promiseWithResolvers<ArrayBufferLike>()
    this.previous = previousResolver.promise
    compressToGzip(visu.bitmap).then(
      previousResolver.resolve,
      previousResolver.reject,
    )

    previousResolver.promise.then((compressed) => {
      console.log(
        `CanvasVisuUpdateBitmap: Compress bitmap to ${humanizedBytes(
          compressed.byteLength,
        )} from ${humanizedBytes(visu.bitmap.byteLength)}`,
      )
    })

    const nextResolver = promiseWithResolvers<ArrayBufferLike>()
    this.updated = nextResolver.promise
    compressToGzip(next).then(nextResolver.resolve, nextResolver.reject)
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

    console.time('decompression')
    visu.bitmap = new Uint8ClampedArray(
      await decompressFromGzip(await this.previous),
    ) as unknown as ReadonlyUint8ClampedArray
    console.timeEnd('decompression')

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

    visu.bitmap = new Uint8ClampedArray(
      await decompressFromGzip(await this.updated),
    ) as unknown as ReadonlyUint8ClampedArray

    docx.invalidateLayerBitmapCache(this.visuUid)
  }

  get effectedVisuUids() {
    return [this.visuUid]
  }
}
