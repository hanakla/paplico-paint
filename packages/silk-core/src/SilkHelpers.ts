import { CompositeMode } from "Entity/IRenderable";
import * as SilkEntity from "./Entity/index";

export async function imageToLayer(img: HTMLImageElement) {
  const layer = SilkEntity.RasterLayer.create({width: img.width, height: img.height})
  const context = Object.assign(
    document.createElement('canvas'),
    {width: img.width, height: img.height}
  ).getContext('2d')!

  context.imageSmoothingEnabled = false
  context.drawImage(img, 0, 0)
  layer.bitmap.set(await (context.getImageData(0,0, img.width, img.height)).data)

  return layer
}

export function validCompositeMode(value: string): value is CompositeMode {
  return value === 'normal' || value === 'multiply' || value === 'screen' || value === 'overlay'
}

