import { FilterContext, FilterInitContext, IFilter } from '../engine/IFilter'

export class GlitchJpeg implements IFilter {
  public static readonly id = '@silk-core/glitch-jpeg'

  public get id() {
    return GlitchJpeg.id
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

    const base = await new Promise<HTMLImageElement>((r) => {
      source.toBlob((blob) => {
        r(loadBlobImage(blob!))
      })
    })

    ctx!.drawImage(base, 0, 0)

    for (let i = 0; i < copies; i++) {
      const image = await new Promise<HTMLImageElement>((r) => {
        ctx.canvas.toBlob(
          (blob) => {
            r(loadBlobImage(blob!))
          },
          'image/jpeg',
          quality
        )
      })

      ctx.clearRect(0, 0, size.width, size.height)
      ctx.drawImage(image, 0, 0)
    }
  }
}

const normalizeDegree = (deg: number) => {
  const norm = deg % 360
  return norm < 0 ? norm + 360 : norm
}

const loadBlobImage = (blob: Blob) => {
  return new Promise<HTMLImageElement>((r) => {
    const img = new Image()
    img.onload = () => {
      r(img)
      URL.revokeObjectURL(img.src)
    }
    img.src = URL.createObjectURL(blob)
  })
}
