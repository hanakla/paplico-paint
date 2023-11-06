import prand from 'pure-rand'
import { ulid } from '@/utils/ulid'

import { PaplicoDocument } from '@/Document/Document'
import { ElementBase, VisuElement } from './VisuElement'
import { VisuFilter } from './VisuallyFilter'
import { LayerNode } from '../LayerNode'

type Requires<T, K extends keyof T> = Omit<T, K> & {
  [P in K]-?: T[P]
}

type Optional<T, K extends keyof T> = Omit<T, K> & { [P in K]?: T[P] }

type FactoryParameter<
  T extends VisuElement.AnyElement,
  RequiredFields extends { requires: Exclude<keyof T, 'uid' | 'type'> } = never,
> = Requires<Partial<Omit<T, 'uid' | 'type'>>, RequiredFields['requires']>

export const DEFAULT_VISU_TRANSFORM = () => ({
  position: { x: 0, y: 0 },
  rotate: 0,
  scale: { x: 1, y: 1 },
})

export const createDocument = ({
  width,
  height,
}: {
  width: number
  height: number
}) => {
  return new PaplicoDocument({ width, height })
}

export const createLayerNode = (
  visually: VisuElement.AnyElement,
): LayerNode => {
  return { visuUid: visually.uid, children: [] }
}

const createElementBase = <T extends VisuElement.AnyElement['type']>({
  type,
  uid,
  name = '',
  visible = true,
  lock = false,
  blendMode = 'normal',
  opacity = 1,
  clipByLowerLayer = false,
  transform = DEFAULT_VISU_TRANSFORM(),
  filters = [],
  features = {},
}: {
  type: T
} & Requires<Partial<ElementBase>, 'uid'>) => ({
  type,
  uid,
  name,
  visible,
  lock,
  blendMode,
  opacity,
  clipByLowerLayer,
  transform,
  filters,
  features,
})

export const createFilterVisually = (
  params: FactoryParameter<VisuElement.FilterElement>,
): VisuElement.FilterElement => ({
  ...createElementBase({
    ...params,
    type: 'filter',
    uid: `filter-${ulid()}`,
  }),
})

export const createGroupVisually = (
  params: FactoryParameter<VisuElement.GroupElement>,
): VisuElement.GroupElement => ({
  ...createElementBase({
    ...params,
    type: 'group',
    uid: `group-${ulid()}`,
  }),
})

export const createCanvasVisually = ({
  width,
  height,
  bitmap = new Uint8ClampedArray(width * height * 4),
  ...etc
}: FactoryParameter<
  VisuElement.CanvasElement,
  { requires: 'width' | 'height' }
>): VisuElement.CanvasElement => ({
  ...createElementBase({
    type: 'canvas',
    uid: `canvas-${ulid()}`,
    ...etc,
  }),
  width,
  height,
  bitmap,
})

export const createImageReferenceVisually = ({
  referenceNodePath = null,
  ...params
}: FactoryParameter<VisuElement.ImageReferenceElement>): VisuElement.ImageReferenceElement => ({
  referenceNodePath,
  ...createElementBase({
    type: 'reference',
    uid: `reference-${ulid()}`,
    ...params,
  }),
})

export const createTextVisually = ({
  fontFamily = '',
  fontStyle = 'Regular',
  fontSize = 12,
  textNodes = [],
  ...etc
}: FactoryParameter<
  VisuElement.TextElement,
  { requires: 'fontFamily' }
>): VisuElement.TextElement => ({
  fontFamily,
  fontStyle,
  fontSize,
  textNodes,
  ...createElementBase({
    type: 'text',
    uid: `text-${ulid()}`,
    ...etc,
  }),
})

export const createVectorObjectVisually = ({
  path,
  clipCotainerGroup = false,
  ...etc
}: FactoryParameter<
  VisuElement.VectorObjectElement,
  { requires: 'path' }
>): VisuElement.VectorObjectElement => ({
  path,
  clipCotainerGroup,
  ...createElementBase({
    type: 'vectorObject',
    uid: `vectorObject-${ulid()}`,
    ...etc,
  }),
})

export const createVectorPath = ({
  points,
  fillRule = 'nonzero',
  randomSeed = prand.mersenne(Math.random()).next()[0],
}: Requires<Partial<VisuElement.VectorPath>, 'points'>) => ({
  points,
  fillRule,
  randomSeed,
})

export const createVisuallyFilter = <
  K extends keyof VisuFilter.AnyFilterMapType,
>(
  kind: K,
  {
    enabled = true,
    ...etc
  }: Optional<Omit<VisuFilter.AnyFilterMapType[K], 'uid' | 'kind'>, 'enabled'>,
): VisuFilter.AnyFilterMapType[K] =>
  ({
    kind,
    uid: `filter-${ulid()}`,
    enabled,
    ...etc,
  }) as any
