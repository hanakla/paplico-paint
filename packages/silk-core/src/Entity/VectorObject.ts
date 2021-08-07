import { IEntity } from './IEntity'
import { Path } from './Path'
import { v4 } from 'uuid'
import { BrushSetting } from './BrushSetting'
import { assign } from '../utils'

export class VectorObject implements IEntity {
  public readonly id: string = `vectorobj-${v4()}`

  public x: number = 0
  public y: number = 0
  public path: Path = null as any
  public brush: BrushSetting = null as any

  public static create({
    x,
    y,
    path,
    brush,
  }: {
    x: number
    y: number
    path: Path
    brush?: BrushSetting
  }) {
    const obj = assign(new VectorObject(), {
      x: x,
      y: y,
      path:
        path ?? Path.create({ start: { x: 0, y: 0 }, points: [], svgPath: '' }),
      brush: {
        id: '@silk-paint/brush',
        color: { r: 0, g: 0, b: 0 },
        weight: 1,
        opacity: 1,
      },
    })

    return obj
  }

  protected constructor() {}

  public serialize() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      // path: this.path.serialize()
      brush: { ...this.brush },
    }
  }
}
