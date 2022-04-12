import { JSDOM } from 'jsdom'
import { SilkSerializer, SilkCanvasFactory, Silk3 } from 'silk-core'
import { connectIdb } from '🙌/infra/indexeddb'

const dom = new JSDOM('<!DOCTYPE html><html></html>')
self.document = dom.window.document

SilkCanvasFactory.setCanvasFactory(() => new OffscreenCanvas(1, 1) as any)

// self.document = {
//   createElementNS: (_: string, name: string) => {
//     console.log('name:', name)
//     return {}
//   },
// }

self.addEventListener('message', async (e) => {
  if (e.data.warm) return

  console.log(e.data)

  const buffer = e.data.buffer as ArrayBuffer
  const document = SilkSerializer.importDocument(new Uint8Array(buffer))

  const db = await connectIdb()

  try {
    const bin = new Blob([buffer], {
      type: 'application/octet-binary',
    })

    const prev = await db.get('projects', document.uid)
    const canvas = new OffscreenCanvas(1, 1)
    const engine = await Silk3.create({ canvas: canvas as any })
    const image = await (
      await engine.renderAndExport(document)
    ).export('image/jpeg', 80)

    await db.put('projects', {
      uid: document.uid,
      bin,
      hasSavedOnce: prev?.hasSavedOnce ?? false,
      thumbnail: image,
      updatedAt: new Date(),
    })

    console.log('ok')
  } finally {
    db.close()
  }
})
