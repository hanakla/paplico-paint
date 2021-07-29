export interface ILayer {
  layerType: 'raster' | 'vector' | 'adjustment' | 'group'
  name: string
  visible: boolean
  lock: boolean
  compositeMode: 'normal' | 'multiply' | 'screen' | 'overlay'

  width: number
  height: number
  x: number
  y: number
}
