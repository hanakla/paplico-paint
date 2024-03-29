import { createContext2D } from '../../Infra/CanvasFactory'
import { canvasToBlob, freeingCanvas, setCanvasSize } from '@/utils/canvas'
import { Emitter } from '@paplico/shared-lib'

type PreviewEntry = {
  layerUid: string
  url: string
}

export namespace PreviewStore {
  export type Events = {
    updated: Readonly<{ layerUid: string; url: string }>
  }
}

export class PreviewStore extends Emitter<PreviewStore.Events> {
  protected cache = new Map<string, PreviewEntry>()

  public dispose() {
    this.mitt.all.clear()

    this.cache.forEach((entry) => URL.revokeObjectURL(entry.url))
    this.cache.clear()
  }

  public entries() {
    return [...this.cache.values()]
  }

  public async generateAndSet(layerUid: string, bitmap: ImageBitmap) {
    // generata thumbnail
    const x = createContext2D()

    try {
      setCanvasSize(x.canvas, 256, 256)
      x.drawImage(bitmap, 0, 0, 256, 256)

      const blob = await canvasToBlob(x.canvas, 'image/png')
      if (!blob) throw new Error('Failed to generate thumbnail')

      const url = URL.createObjectURL(blob)

      const old = this.cache.get(layerUid)
      if (old) URL.revokeObjectURL(old.url)

      this.cache.set(layerUid, { layerUid, url })
      this.emit('updated', Object.freeze({ layerUid, url }))
    } finally {
      freeingCanvas(x.canvas)
    }
  }

  public get(layerUid: string): PreviewEntry | undefined {
    return this.cache.get(layerUid)
  }
}
