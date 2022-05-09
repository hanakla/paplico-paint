import { PapSerializer, PapCanvasFactory, PaplicoEngine } from '@paplico/core'
import { connectIdb } from '🙌/infra/indexeddb'

PapCanvasFactory.setCanvasFactory(() => new OffscreenCanvas(1, 1) as any)

const canvas = new OffscreenCanvas(1, 1)
const engineInit = PaplicoEngine.create({ canvas: canvas as any })

self.addEventListener('message', async (ev) => {
  if (ev.data.type === 'warm') return
  else if (ev.data.type === 'request') {
    const buffer = ev.data.buffer as ArrayBuffer
    const { document, extra } = PapSerializer.importDocument(
      new Uint8Array(buffer)
    )

    const db = await connectIdb()

    try {
      const bin = new Blob([buffer], {
        type: 'application/octet-binary',
      })

      const prev = await db.get('projects', document.uid)
      const engine = await engineInit

      const image = await (
        await engine.renderAndExport(document)
      ).export('image/png')

      const bitmap = await createImageBitmap(image)
      const canvas = new OffscreenCanvas(
        Math.floor(bitmap.width / 2),
        Math.floor(bitmap.height / 2)
      )
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

      await db.put('projects', {
        uid: document.uid,
        title: document.title,
        bin,
        hasSavedOnce: prev?.hasSavedOnce ?? false,
        thumbnail: await canvas.convertToBlob({
          type: 'image/png',
        }),
        updatedAt: new Date(),
      })

      postMessage({ id: ev.data.id, success: true })
    } catch (e) {
      postMessage({ id: ev.data.id, success: false })
      throw e
    } finally {
      db.close()
    }
  }
})
