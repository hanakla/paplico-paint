import { Active, Over } from '@dnd-kit/core'
import { rgba } from 'polished'
import { Silk3, SilkDOM, SilkInks, SilkValue } from 'silk-core'
import { assign } from '🙌/utils/object'

export const isEventIgnoringTarget = (target: EventTarget | null) => {
  return (target as HTMLElement)?.dataset?.isPaintCanvas != null
}

export type FlatLayerEntry = {
  path: string[]
  layer: SilkDOM.LayerTypes
  depth: number
  index: number
  parentIdx: number | null
}

export const calcLayerMove = (
  flattenLayers: FlatLayerEntry[],
  {
    active,
    over,
  }: {
    active: Active
    over: Over | null
  }
) => {
  if (!over || active.id === over.id) return

  const indexOnFlatten = flattenLayers.findIndex(
    (l) => l.layer.uid === active.id
  )
  const nextIndexOnFlatten = flattenLayers.findIndex(
    (l) => l.layer.uid === over.id
  )

  const entry = flattenLayers[indexOnFlatten]

  const oldIndex = indexOnFlatten - (entry.parentIdx ?? 0)
  const newIndex = nextIndexOnFlatten - (entry.parentIdx ?? 0)

  // TODO: レイヤーをまたいだDnD
  return { sourcePath: entry.path, oldIndex, newIndex }
}

export const flattenLayers = (
  layers: SilkDOM.LayerTypes[]
): FlatLayerEntry[] => {
  return layers
    .map((l, idx) => {
      return l.layerType === 'group'
        ? // (),
          [
            // { path: [], layer: l, depth: 0, index: idx, parentIdx: null },
            {
              path: [],
              layer: l,
              depth: 0,
              index: idx,
              parentIdx: null,
            },
            ...l.layers.map((sl, subIdx) => ({
              path: [l.uid],
              layer: sl,
              depth: 1,
              index: subIdx,
              parentIdx: idx,
            })),
          ]
        : {
            path: [],
            layer: l,
            depth: 0,
            index: idx,
            parentIdx: null,
          }
    })
    .flat(2)
}

export const generateBrushThumbnail = async (
  engine: Silk3,
  brushId: string,
  {
    size,
    brushSize,
  }: { size: { width: number; height: number }; brushSize: number }
) => {
  const ctx = document.createElement('canvas').getContext('2d')!
  assign(ctx.canvas, size)

  const path = SilkDOM.Path.create({
    points: [
      {
        x: size.width / 2,
        y: size.height / 2,
        in: null,
        out: null,
        pressure: 1,
      },
      {
        x: size.width / 2,
        y: size.height / 2,
        in: null,
        out: null,
        pressure: 1,
      },
    ],
    closed: false,
    randomSeed: 0,
  })

  await engine.renderPath(
    {
      brushId,
      color: { r: 0, g: 0, b: 0 },
      opacity: 1,
      size: brushSize,
      specific: {},
    },
    new SilkInks.PlainInk(),
    path,
    ctx
  )

  return ctx.canvas.toDataURL('image/png')
}

export const swapObjectBrushAndFill = (
  obj: SilkDOM.VectorObject,
  { fallbackBrushId }: { fallbackBrushId: string }
) => {
  const fill = obj.fill

  obj.fill = obj.brush
    ? { type: 'fill', color: obj.brush.color, opacity: obj.brush.opacity }
    : null

  obj.brush = fill
    ? {
        brushId: fallbackBrushId,
        color:
          fill.type === 'fill'
            ? { ...fill.color }
            : { ...fill.colorStops[0].color },
        opacity: fill.opacity,
        size: 1,
      }
    : null
}

export const normalRgbToRgbArray = (color: {
  r: number
  g: number
  b: number
}) => {
  const c = normalRGBAToRGBA(color)
  return [c.r, c.g, c.b] as const
}

export const normalRGBAToRGBA = (color: {
  r: number
  g: number
  b: number
  a?: number
}) => {
  return {
    r: Math.round(color.r * 255),
    g: Math.round(color.g * 255),
    b: Math.round(color.b * 255),
    ...(color.a != null ? { a: color.a } : {}),
  }
}

export const colorStopsToCssGradient = (
  degree: number,
  colorStops: SilkValue.ColorStop[]
): string => {
  return `linear-gradient(${degree}deg, ${colorStops
    .map(
      ({ color, position }) =>
        `${rgba(...normalRgbToRgbArray(color), color.a)} ${position * 100}%`
    )
    .join(', ')})`
}
