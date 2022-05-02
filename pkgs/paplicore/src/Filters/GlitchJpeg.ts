import { FilterContext, FilterInitContext, IFilter } from '../engine/IFilter'
import { workerSafeCanvasToBlob } from '../PapHelpers'

export class GlitchJpegFilter implements IFilter {
  public static readonly id = '@paplico/filters/glitch-jpeg'

  public get id() {
    return GlitchJpegFilter.id
  }

  public get initialConfig() {
    return {
      copies: 2,
      quality: 1,
    }
  }

  // private program: WebGLContext.ProgramSet | null = null
  // private composer: EffectComposer
  public async initialize({ gl }: FilterInitContext) {}

  public async render({
    source,
    threeRenderer,
    threeCamera,
    dest,
    // gl,
    size,
    settings: { copies, quality },
  }: FilterContext) {
    const ctx = dest.getContext('2d')!

    const base = await loadBlobImage(
      await workerSafeCanvasToBlob(source, { type: 'image/png' })
    )

    ctx!.drawImage(base, 0, 0)

    for (let i = 0; i < copies; i++) {
      const image = await loadBlobImage(
        await workerSafeCanvasToBlob(ctx.canvas, {
          type: 'image/jpeg',
          quality,
        })
      )

      ctx.clearRect(0, 0, size.width, size.height)
      ctx.drawImage(image, 0, 0)
    }
  }
}

const normalizeDegree = (deg: number) => {
  const norm = deg % 360
  return norm < 0 ? norm + 360 : norm
}

const loadBlobImage = async (blob: Blob) => {
  return await createImageBitmap(blob)
}
