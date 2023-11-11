import prand from 'pure-rand'
import { ulid } from '@/utils/ulid'

import { PaplicoDocument } from '@/Document/PaplicoDocument'
import { ElementBase, VisuElement } from './VisuElement'
import { VisuFilter } from './VisuFilter'
import { LayerNode } from '../Structs/LayerNode'
import { imageBitmapToImageData, loadImage } from '@/utils/imageObject'
import { deepClone } from '@paplico/shared-lib'
import { PPLCOptionInvariantViolationError } from '@/Errors'

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
  transform: deepClone(transform),
  filters: deepClone(filters),
  features: deepClone(features),
})

export const createFilterVisually = (
  params: FactoryParameter<VisuElement.FilterElement>,
): VisuElement.FilterElement => ({
  ...createElementBase({
    ...deepClone(params),
    type: 'filter',
    uid: `filter-${ulid()}`,
  }),
})

export const createGroupVisually = (
  params: FactoryParameter<VisuElement.GroupElement>,
): VisuElement.GroupElement => ({
  ...createElementBase({
    ...deepClone(params),
    type: 'group',
    uid: `group-${ulid()}`,
  }),
})

export const createCanvasVisually = ({
  width,
  height,
  bitmap = new Uint8ClampedArray(width * height * 4),
  colorSpace = 'srgb',
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
  colorSpace,
})

export const createCanvasVisuallyFromImage = async (
  imageOrUrl: ImageBitmapSource | string,
  {
    colorSpaceConversion,
    colorSpace,
    imageOrientation,
    ...params
  }: Omit<
    FactoryParameter<
      VisuElement.CanvasElement,
      { requires: 'width' | 'height' }
    >,
    'width' | 'height'
  > & {
    /** Pass to createImageBitmap() internally */
    colorSpaceConversion?: ImageBitmapOptions['colorSpaceConversion']
    /** Pass to createImageBitmap() internally */
    imageOrientation?: ImageBitmapOptions['imageOrientation']
    /** Pass to createCanvas and canvas.getImageData internally */
    colorSpace?: PredefinedColorSpace
  },
): Promise<VisuElement.CanvasElement> => {
  let img: ImageBitmapSource

  if (typeof imageOrUrl === 'string') {
    img = await loadImage(imageOrUrl)
  } else {
    img = imageOrUrl
  }

  const bitmap = await createImageBitmap(img, {
    colorSpaceConversion,
    imageOrientation,
  })
  const imageData = imageBitmapToImageData(bitmap, { colorSpace })

  return createCanvasVisually({
    width: imageData.width,
    height: imageData.height,
    bitmap: imageData.data,
    colorSpace,
    ...deepClone(params),
  })
}

export const createImageReferenceVisually = ({
  referenceNodePath = null,
  ...params
}: FactoryParameter<VisuElement.ImageReferenceElement>): VisuElement.ImageReferenceElement => ({
  referenceNodePath,
  ...createElementBase({
    type: 'reference',
    uid: `reference-${ulid()}`,
    ...deepClone(params),
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
  textNodes: deepClone(textNodes),
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
    ...deepClone(etc),
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
  }: Optional<
    Omit<VisuFilter.AnyFilterMapType[K], 'uid' | 'kind'>,
    // @ts-expect-error
    'enabled'
  >,
): VisuFilter.AnyFilterMapType[K] => {
  if (kind === 'fill' && 'fill' in etc) {
    return {
      uid: `filter-fill-${ulid()}`,
      kind,
      enabled,
      fill: deepClone((etc as any).fill),
    } satisfies VisuFilter.FillFilter as any
  } else if (kind === 'stroke') {
    return {
      uid: `filter-stroke-${ulid()}`,
      kind,
      enabled,
      ink: deepClone((etc as any).ink),
      stroke: deepClone((etc as any).stroke),
    } satisfies VisuFilter.StrokeFilter<any> as any
  } else if (kind === 'postprocess') {
    return {
      uid: `filter-postprocess-${ulid()}`,
      kind,
      enabled,
      processor: deepClone((etc as any).processor),
    } satisfies VisuFilter.PostProcessFilter<any> as any
  } else {
    throw new PPLCOptionInvariantViolationError(`Unknown filter kind: ${kind}`)
  }
}
