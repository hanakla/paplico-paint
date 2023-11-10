import { Emitter } from '@paplico/shared-lib'
import { parse, Font } from 'opentype.js'

export type FontEntry = {
  family: string
  styles: (BinaryFontStyle | LocalFontStyle)[]
}

export type FontStyleEntry = BinaryFontStyle | LocalFontStyle

type BinaryFontStyle = {
  type: 'binary'
  name: string
  font: Font
}

type LocalFontStyle = {
  type: 'local'
  name: string
  blob: () => Promise<Blob>
  _blob?: WeakRef<Blob>
  font: Font | null
}

// type DOMFontStyle = {
//   type: 'dom'
//   name: string
// }

type QueryLocalFonts = () => Promise<LocalFontData[]>
type LocalFontData = {
  family: string
  fullName: string
  postScriptName: string
  style: string
  blob: () => Promise<Blob>
}

export class FontRegistry extends Emitter<{}> {
  protected cache: Map</* Family name */ string, FontEntry> = new Map()

  public async requestToRegisterLocalFonts() {
    if (!('queryLocalFonts' in window)) {
      console.info(
        'FontRegistry.requestToRegisterLocalFonts: window.queryLocalFonts is not available',
      )
      return
    }

    const fontsMap = new Map<string, FontEntry>()
    const fonts = await (window.queryLocalFonts as QueryLocalFonts)()
    for (const font of fonts) {
      const { family, style } = font

      const entry: FontEntry = fontsMap.get(family) ?? {
        family,
        styles: [],
      }

      const styleEntry: LocalFontStyle = {
        type: 'local',
        name: style,
        blob: async () => {
          const deref = styleEntry._blob?.deref()
          if (deref) return deref

          const bin = await font.blob()
          styleEntry._blob = new WeakRef(bin)
          return bin
        },
        font: null,
      }

      entry.styles.push(styleEntry)

      fontsMap.set(family, entry)
    }

    fontsMap.forEach((entry) => {
      this.cache.set(entry.family, entry)
    })
  }

  // public async registerDocumentFont(familyName: string, styleName: string) {
  //   const entry: FontEntry = this.cache.get(familyName) ?? {
  //     family: familyName,
  //     styles: [],
  //   }

  //   entry.styles.push({
  //     type: 'dom',
  //     name: styleName,
  //   })
  // }

  public async registerFromBlob(blob: Blob) {
    const data = parse(await blob.arrayBuffer())
    console.log(data)

    const familyName = data.names.fontFamily.en
    const entry: FontEntry = this.cache.get(familyName) ?? {
      family: familyName,
      styles: [],
    }

    console.log(data.getPath('H', 0, 0, 12))

    entry.styles.push({
      type: 'binary',
      font: data,
      name: data.names.fontSubfamily.en,
    })
  }

  public queryFont(family: string, style?: string): FontStyleEntry[] {
    const entry = this.cache.get(family)
    if (!entry) return []

    if (!style) {
      return entry.styles
    }

    return entry.styles.filter((s) => s.name === style) ?? []
  }

  public async getFont(
    family: string,
    style?: string,
    {
      fallback = {
        family: 'Hiragino Sans',
      },
    }: {
      fallback?: {
        family: string
        style?: string
      }
    } = {},
  ): Promise<Font | null> {
    let [entry] =
      this.queryFont(family, style) ??
      this.queryFont(fallback.family, fallback.style)

    if (!entry) return null

    if (entry.type === 'binary') {
      return entry.font
    } else if (entry.type === 'local') {
      if (entry.font) return entry.font

      const blob = await entry.blob()
      const font = parse(await blob.arrayBuffer())
      entry.font = font
      return font
    }

    return null
  }

  public get entries() {
    return [...this.cache].filter(([, entry]) => ({
      family: entry.family,
      styles: entry.styles.map((s) => s.name),
    }))
  }

  // public getEntries() {
  //   return [...this.cache.values()]
  // }
}
