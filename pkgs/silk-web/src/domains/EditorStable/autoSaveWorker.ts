import { SilkSerializer, SilkCanvasFactory, Silk3 } from 'silk-core'
import { connectIdb } from '🙌/infra/indexeddb'

SilkCanvasFactory.setCanvasFactory(() => new OffscreenCanvas(1, 1) as any)

const canvas = new OffscreenCanvas(1, 1)
const engineInit = Silk3.create({ canvas: canvas as any })

self.addEventListener('message', async (e) => {
  if (e.data.warm) return

  const buffer = e.data.buffer as ArrayBuffer
  const { document, extra } = SilkSerializer.importDocument(
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

    console.log('ok')
  } finally {
    db.close()
  }
})
