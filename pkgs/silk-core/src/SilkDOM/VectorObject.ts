import { v4 } from 'uuid'

import { IEntity } from './IEntity'
import { Path } from './Path'
import { BrushSetting } from '../Value/BrushSetting'
import { FillSetting } from '../Value/FillSetting'
import { assign, deepClone } from '../utils'

export class VectorObject implements IEntity {
  public readonly uid: string = `vectorobj-${v4()}`

  public x: number = 0
  public y: number = 0
  public path: Path = null as any
  public brush: BrushSetting | null = null
  public fill: FillSetting | null = null
  // public appearances: ObjectAppearance[]

  public static create({
    x,
    y,
    path = Path.create({ points: [], closed: false }),
    brush = {
      brushId: '@silk-paint/brush',
      color: { r: 0, g: 0, b: 0 },
      weight: 1,
      opacity: 1,
    },
    fill = {
      type: 'fill',
      color: { r: 0, g: 0, b: 0 },
      opacity: 1,
    },
  }: {
    x: number
    y: number
    path: Path
    brush?: BrushSetting | null
    fill?: FillSetting | null
  }) {
    return assign(new VectorObject(), {
      x: x,
      y: y,
      path,
      brush,
      fill,
    })
  }

  public static deserialize(obj: any) {
    return assign(new VectorObject(), {
      uid: obj.uid,
      x: obj.x,
      y: obj.y,
      path: Path.deserialize(obj.path),
      brush: obj.brush,
    })
  }

  protected constructor() {}

  public serialize() {
    return {
      uid: this.uid,
      x: this.x,
      y: this.y,
      path: this.path.serialize(),
      brush: deepClone(this.brush),
    }
  }
}
