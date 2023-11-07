import { IExporter } from './IExporter'
import {
  ColorRGB,
  ColorRGBA,
  PaplicoDocument,
  VisuElement,
  VisuFilter,
} from '@/Document'
import { createContext2D } from '../../Infra/CanvasFactory'
import { setCanvasSize } from '@/utils/canvas'
import { vectorPathPointsToSVGPath } from '@/SVGPathManipul'
import { ulid } from '@/utils/ulid'
import { unreachable } from '@/utils/unreachable'

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

    const targetNode = paplico.currentDocument.getResolvedLayerTree(
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

    async function nodeToSVG(
      node: PaplicoDocument.ResolvedLayerNode,
    ): Promise<string> {
      const { visu } = node
      const blendMode = paplicoBlendModeToSVGMixBlendMode(visu.blendMode)

      if (visu.type === 'group') {
        const children = await Promise.all(
          node.children.map((n) => nodeToSVG(n)),
        )

        return svgElement(
          'g',
          {
            'data-pplc-id': visu.uid,
            'data-pplc-layer-name': visu.name ?? 'Group',
            style: `mix-blend-mode:${blendMode};`,
          },
          children.join(''),
        )

        // return `<g style="mix-blend-mode:${blendMode};">${children.join(
        //   '',
        // )}</g>`
      } else if (visu.type === 'canvas') {
        setCanvasSize(
          cx.canvas,
          Math.round(visu.width * pixelRatio),
          Math.round(visu.height * pixelRatio),
        )

        cx.drawImage(
          await createImageBitmap(
            new ImageData(visu.bitmap, visu.width, visu.height),
          ),
          visu.transform.position.x * pixelRatio,
          visu.transform.position.y * pixelRatio,
          visu.width * pixelRatio,
          visu.height * pixelRatio,
        )

        const datauri = cx.canvas.toDataURL('image/png')

        return svgElement('image', {
          'data-pplc-id': (visu.uid),
          'data-pplc-layer-name': (visu.name ?? 'Raster layer'),
          style: `mix-blend-mode:${blendMode};`,
          href: datauri,
          width: visu.width,
          height: visu.height,
        })

        // prettier-ignore
        // return `<g data-pap-id="${quoteattr(visu.uid,)}" data-pap-layer-name="${quoteattr(visu.name ?? 'Raster layer')}" style="mix-blend-mode:${blendMode};">`
        //   + `<image href="${datauri}" width="${visu.width}" height="${visu.height}" />`
        //   + `</g>`
      } else if (visu.type === 'vectorObject') {
        function toCSSColor(color: ColorRGB | ColorRGBA, alpha?: number) {
          // prettier-ignore
          if (alpha != null) return `rgba(${color.r * 255}, ${color.g * 255}, ${color.b * 255}, ${alpha})`
              else if ('a' in color)return `rgba(${color.r * 255}, ${color.g * 255}, ${color.b * 255}, ${color.a})`
              else return `rgb(${color.r * 255}, ${color.g * 255}, ${color.b * 255})`
        }

        const path = vectorPathPointsToSVGPath(visu.path.points)
        const fill = findLast(
          visu.filters,
          (a): a is VisuFilter.FillFilter => a.kind === 'fill',
        )
        const stroke = findLast(
          visu.filters,
          (a): a is VisuFilter.StrokeFilter => a.kind === 'stroke',
        )

        const defsUid = ulid()

        if (fill?.fill.type === 'linear-gradient') {
          // prettier-ignore
          defs.push(
            svgElement('linearGradient', {
              id: defsUid,
              x1: fill.fill.start.x,
              y1: fill.fill.start.y,
              x2: fill.fill.end.x,
              y2: fill.fill.end.y,
            }, fill.fill.colorStops.map((stop) => {
              return svgElement('stop', {offset: `${stop.position * 100}%`, "stop-color": toCSSColor(stop.color)})
            }).join(''))
          )
        }

        return svgElement('path', {
          'fill-rule': visu.path.fillRule,
          style: `mix-blend-mode:${blendMode};`,
          ...(stroke
            ? {
                stroke: toCSSColor(stroke.stroke.color, stroke.stroke.opacity),
                strokeWidth: stroke.stroke.size,
              }
            : { stroke: 'none' }),
          ...(fill
            ? {
                fill:
                  fill?.fill.type === 'fill'
                    ? toCSSColor(fill.fill.color, fill.fill.opacity)
                    : fill?.fill.type === 'linear-gradient'
                    ? 'url(#${defsUid})'
                    : unreachable(fill.fill),
              }
            : { fill: 'none' }),
        })
      } else if (visu.type === 'text') {
        const styleAttr = ` style="mix-blend-mode:${blendMode};"`

        return svgElement(
          'text',
          {
            x: visu.transform.position.x,
            y: visu.transform.position.y,
            'font-size': visu.fontSize,
            ...((visu.fontFamily ?? 'Poppins') !== 'Poppins'
              ? { 'font-family': visu.fontFamily }
              : {}),
            ...((visu.fontStyle ?? 'Regular') !== 'Regular'
              ? { 'font-style': visu.fontStyle }
              : {}),
          },
          visu.textNodes.map((tn) => quoteattr(tn.text)).join(''),
        )
      } else {
        return ''
      }
    }
  }
}

function svgElement(
  type: string,
  attr: Record<string, any>,
  children?: string,
) {
  const attrString = Object.entries(attr)
    .map(([key, value]) => {
      return value == null ? null : `${key}="${quoteattr(value.toString())}"`
    })
    .filter((s): s is string => typeof s === 'string')
    .join(' ')

  return `<${type} ${attrString} ${children ? children + `</${type}>` : '/>'}`
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

function paplicoBlendModeToSVGMixBlendMode(blend: VisuElement.BlendMode) {
  // prettier-ignore
  return blend === 'normal' ? 'normal'
    : blend === 'multiply' ? 'multiply'
    : blend === 'screen' ? 'screen'
    : blend === 'overlay' ? 'overlay'
    : unreachable(blend)
  // : blend === 'clipper' ? { special: 'clip'}
}
