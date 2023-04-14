import { Active, Over } from '@dnd-kit/core'
import { rgba } from 'polished'
import { Document, Paplico } from '@paplico/core-new'
import { assign } from '🙌/utils/object'
import arrayMove from 'array-move'

export const isEventIgnoringTarget = (target: EventTarget | null) => {
  return (target as HTMLElement)?.dataset?.isPaintCanvas != null
}

export type FlatLayerEntry = {
  id: string
  parentId: string | null
  index: number
  indexInParent: number
  depth: number
  parentPath: string[]
} & (
  | {
      type: 'layer'
      layer: PapDOM.LayerTypes
    }
  | {
      type: 'object'
      object: PapDOM.VectorObject
    }
)

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

  const movedEntryIndex = flattenLayers.findIndex((l) => l.id === active.id)
  const newIndexOnFlatten = flattenLayers.findIndex((l) => l.id === over.id)

  const movedEntry = flattenLayers[movedEntryIndex]
  const entryAtNewIndex = flattenLayers[newIndexOnFlatten]

  let parent: FlatLayerEntry | null =
    // prettier-ignore
    newIndexOnFlatten === 0 ? null
      : (entryAtNewIndex.type === 'layer' && entryAtNewIndex.layer.layerType === 'group') ? entryAtNewIndex
      : entryAtNewIndex.parentId != null ? (flattenLayers.find(e => e.id === entryAtNewIndex.parentId) ?? null)
      : null

  const entryAtPrevIndex = flattenLayers[newIndexOnFlatten - 1]
  if (entryAtPrevIndex) {
    console.log(active.rect.current)
    if (entryAtPrevIndex.depth !== movedEntry.depth) {
      parent = flattenLayers.find(
        (entry) => entry.id === entryAtPrevIndex.parentId
      )!
    }
  }

  if (movedEntry.type === 'layer') {
    if (
      parent != null && // not in document root
      (parent.type !== 'layer' || parent?.layer.layerType !== 'group') // out of group
    )
      return null

    return {
      type: 'layer' as const,
      sourcePath: [...movedEntry.parentPath, movedEntry.layer.uid],
      targetParentPath:
        parent?.type === 'layer'
          ? [...parent.parentPath, parent.layer.uid]
          : [],
      targetIndex: entryAtNewIndex.indexInParent,
    }
  } else if (movedEntry.type === 'object') {
    if (parent?.type !== 'layer') return null

    return {
      type: 'object' as const,
      sourcePath: movedEntry.parentPath,
      targetParentPath: [...parent.parentPath, parent.layer.uid],
      targetIndex: entryAtNewIndex.indexInParent,
      objectUid: movedEntry.object.uid,
    }
  }

  return null
}

const findLastIndexFrom = <T>(
  arr: T[],
  { from }: { from: number },
  predicate: (v: T, index: number, list: T[]) => boolean
) => {
  for (let idx = from; idx >= 0; idx--) {
    if (predicate(arr[idx], idx, arr)) return idx
  }

  return null
}

export const flattenLayers = (
  layers: PapDOM.LayerTypes[],
  filter: (
    entry: FlatLayerEntry,
    idx: number,
    list: FlatLayerEntry[]
  ) => boolean = () => true
): FlatLayerEntry[] => {
  const flatter = (
    layers: PapDOM.LayerTypes[],
    parentPath: string[],
    parentIndex: number | null,
    entries: FlatLayerEntry[]
  ) => {
    layers.forEach((layer, index) => {
      const entry: FlatLayerEntry = {
        id: layer.uid,
        parentId: parentPath.slice(-1)[0],
        type: 'layer',
        layer,
        parentPath,
        indexInParent: index,
        depth: parentPath.length,
        index: entries.length,
      }

      entries.push(entry)

      if (layer.layerType === 'group') {
        flatter(
          layer.layers,
          [...parentPath, layer.uid],
          entries.length - 1,
          entries
        )
      } else if (layer.layerType === 'vector') {
        const parentIdx = entries.indexOf(entry)

        entries.push(
          ...layer.objects.map((o, i) => ({
            id: o.uid,
            parentId: layer.uid,
            indexInParent: i,
            type: 'object' as const,
            object: o,
            parentPath: [...parentPath, layer.uid],
            depth: parentPath.length + 1,
            index: entries.length + 1 + i,
          }))
        )
      }
    })

    return entries
  }

  return flatter(layers, [], null, [])
    .filter(filter)
    .map((entry, index) => assign(entry, { index }))

  // return layers
  //   .map((l, idx) => {
  //     const self = {
  //       parentPath: [],
  //       layer: l,
  //       depth: 0,
  //       index: idx,
  //       parentIdx: null,
  //     }

  //     return l.layerType === 'group'
  //       ?
  //         [
  //           self,
  //           ...l.layers.map((sl, subIdx) => ({
  //             parentPath: [l.uid],
  //             layer: sl,
  //             depth: 1,
  //             index: subIdx,
  //             parentIdx: idx,
  //           })),
  //         ]
  //       l.layerType === 'vector' ?
  //       [
  //         self,

  //       ]
  //       : self
  //   })
  //   .flat(2)
}

export const generateBrushThumbnail = async (
  engine: Paplico,
  brushId: string,
  {
    size,
    brushSize,
    specific,
  }: {
    size: { width: number; height: number }
    brushSize: number
    specific: Record<string, any> | null
  }
) => {
  const ctx = document.createElement('canvas').getContext('2d')!
  assign(ctx.canvas, size)

  const path = Document.createVectorPath({
    points: [
      {
        x: size.width / 6,
        y: size.height / 2,
        in: null,
        out: { x: size.width / 2, y: size.height - size.height / 5 },
        pressure: 1,
      },
      {
        x: size.width - size.width / 6,
        y: size.height / 2,
        in: { x: size.width - size.width / 2, y: size.height / 5 },
        out: null,
        pressure: 1,
      },
    ],
    closed: false,
    randomSeed: 0,
  })

  await engine.renderer.renderStroke(
    ctx.canvas,
    path,
    {
      brushId,
      color: { r: 0, g: 0, b: 0 },
      opacity: 1,
      size: brushSize,
      specific: specific ?? {},
    },
    { rotate: 0, scale: { x: 1, y: 1 }, translate: { x: 0, y: 0 } }
  )

  return ctx.canvas.toDataURL('image/png')
}

export const swapObjectBrushAndFill = (
  obj: Document,
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
  colorStops: PapValueTypes.ColorStop[]
): string => {
  return `linear-gradient(${degree}deg, ${colorStops
    .map(
      ({ color, position }) =>
        `${rgba(...normalRgbToRgbArray(color), color.a)} ${position * 100}%`
    )
    .join(', ')})`
}
