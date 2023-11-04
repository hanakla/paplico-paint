import { IExporter } from './IExporter'
import { ColorRGB, ColorRGBA, LayerNode } from '@/Document'
import { createContext2D } from '../CanvasFactory'
import { setCanvasSize } from '@/utils/canvas'
import { vectorPathPointsToSVGPathString } from '@/SVGPathManipul'
import {
  VectorAppearanceFill,
  VectorAppearanceStroke,
} from '@/Document/LayerEntity/VectorAppearance'
import { ulid } from '@/utils/ulid'

export namespace SVGExporter {
  export type Options = IExporter.Options<{ looseSVGOriginalStrict: boolean }>
}

export class SVGExporter implements IExporter {
  async export(
    { paplico, runtimeDocument }: IExporter.Context,
    { pixelRatio, ...options }: SVGExporter.Options,
  ): Promise<Blob> {
    if (!paplico.currentDocument) {
      throw new Error('SVGExporter: No document is opened')
    }

    const targetNode = paplico.currentDocument.resolveNodePath(
      options.targetNodePath ?? [],
    )
    if (!targetNode) {
      throw new Error('SVGExporter: Target node not found')
    }

    const { mainArtboard } = runtimeDocument.document.meta

    const cx = createContext2D()

    const defs: string[] = []
    const svg = [
      `<?xml version="1.0" encoding="UTF-8" standalone="no"?>`,
      `<svg xmlns="http://www.w3.org/2000/svg" width="${mainArtboard.width}" height="${mainArtboard.height}" viewBox="0 0 ${mainArtboard.width} ${mainArtboard.height}">`,
      `<defs>${defs.join('\n')}</defs>`,
      await nodeToSVG(targetNode),
      `</svg>`,
    ].join('')

    return new Blob([svg], { type: 'image/svg+xml' })

    async function nodeToSVG(node: LayerNode): Promise<string> {
      const layer = paplico.currentDocument!.resolveLayerEntity(node.layerUid)
      if (!layer) return ''

      if (layer.layerType === 'root') {
        const children = await Promise.all(
          node.children.map((n) => nodeToSVG(n)),
        )

        return children.join('')
      } else if (layer.layerType === 'raster') {
        setCanvasSize(
          cx.canvas,
          Math.round(layer.width * pixelRatio),
          Math.round(layer.height * pixelRatio),
        )

        cx.drawImage(
          await createImageBitmap(
            new ImageData(layer.bitmap, layer.width, layer.height),
          ),
          layer.transform.position.x * pixelRatio,
          layer.transform.position.y * pixelRatio,
          layer.width * pixelRatio,
          layer.height * pixelRatio,
        )

        const datauri = cx.canvas.toDataURL('image/png')

        // prettier-ignore
        return `<g data-pap-id="${quoteattr(layer.uid,)}" data-pap-layer-name="${quoteattr(layer.name ?? 'Raster layer')}">`
          + `<image href="${datauri}" width="${layer.width}" height="${layer.height}" />`
          + `</g>`
      } else if (layer.layerType === 'vector') {
        const objectsPathes = layer.objects.map((obj) => {
          if (obj.type === 'vectorObject') {
            function toCSSColor(color: ColorRGB | ColorRGBA, alpha?: number) {
              // prettier-ignore
              if (alpha != null) return `rgba(${color.r * 255}, ${color.g * 255}, ${color.b * 255}, ${alpha})`
              else if ('a' in color)return `rgba(${color.r * 255}, ${color.g * 255}, ${color.b * 255}, ${color.a})`
              else return `rgb(${color.r * 255}, ${color.g * 255}, ${color.b * 255})`
            }

            const path = vectorPathPointsToSVGPathString(obj.path)
            const fill = findLast(
              obj.filters,
              (a): a is VectorAppearanceFill => a.kind === 'fill',
            )
            const stroke = findLast(
              obj.filters,
              (a): a is VectorAppearanceStroke => a.kind === 'stroke',
            )

            const defsUid = ulid()

            if (fill?.fill.type === 'linear-gradient') {
              // prettier-ignore
              defs.push(
                [
                  `<linearGradient id="${defsUid}" x1="${fill.fill.start.x}" y1="${fill.fill.start.y}" x2="${fill.fill.end.x}" y2="${fill.fill.end.y}">`,
                  ...fill.fill.colorStops.map((stop) => {
                    return `<stop offset="${stop.position * 100}%" stop-color="${toCSSColor(stop.color)}" />`
                  }),
                  '</linearGradient>',
                ].join(''),
              )
            }

            // prettier-ignore
            const fillAttr =
              fill?.fill.type === 'fill' ? ` fill="${toCSSColor(fill.fill.color, fill.fill.opacity)}"`
              : fill?.fill.type === 'linear-gradient' ? ` fill="url(#${defsUid})"`
              : ' fill="none"'

            // prettier-ignore
            const strokeAttr =
              stroke?.kind === 'stroke' ? ` stroke="${toCSSColor(stroke.stroke.color, stroke.stroke.opacity)}" strokeWidth="${stroke.stroke.size}"`
              : ' stroke="none"'

            return `<path d="${path}"${fillAttr}${strokeAttr} />`
          } else {
            return ''
          }
        })

        const children = await Promise.all(
          node.children.map((n) => nodeToSVG(n)),
        )

        return [
          `<g data-pap-node-id="${node.layerUid}" data-pap-layer-name="${layer.name}">`,
          objectsPathes.join('\n'),
          children.join(''),
          `</g>`,
        ].join('')
      } else {
        return ''
      }
    }
  }
}

// FROM: https://stackoverflow.com/questions/7753448/how-do-i-escape-quotes-in-html-attribute-values
function quoteattr(s: string, preserveCR: boolean = true) {
  const cr = preserveCR ? '&#13;' : '\n'
  return (
    ('' + s) /* Forces the conversion to string. */
      .replace(/&/g, '&amp;') /* This MUST be the 1st replacement. */
      .replace(/'/g, '&apos;') /* The 4 other predefined entities, required. */
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      /*
      You may add other replacements here for HTML only
      (but it's not necessary).
      Or for XML, only if the named entities are defined in its DTD.
      */
      .replace(/\r\n/g, cr) /* Must be before the next replacement. */
      .replace(/[\r\n]/g, cr)
  )
}

type A<T> = {
  find<S extends T>(
    predicate: (value: T, index: number, obj: T[]) => value is S,
    thisArg?: any,
  ): S | undefined
}

function findLast<T, S extends T>(
  arr: T[],
  predicate: (item: T, index: number, list: T[]) => item is S,
): S | undefined {
  const idx = arr.findIndex(predicate)
  if (idx === -1) return
  return arr[idx] as S
}
