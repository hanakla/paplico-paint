export type CompositeMode = 'normal' | 'multiply' | 'screen' | 'overlay'

export interface ILayer {
  layerType: 'raster' | 'vector' | 'filter' | 'group'
  name: string
  visible: boolean
  lock: boolean
  compositeMode: CompositeMode
  /** 0 to 100 */
  opacity: number

  width: number
  height: number
  x: number
  y: number

  serialize(): any
}
