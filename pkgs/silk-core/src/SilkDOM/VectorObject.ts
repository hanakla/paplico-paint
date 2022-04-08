import { v4 } from 'uuid'
// import DOMMatrix from 'dommatrix'

import { ISilkDOMElement } from './ISilkDOMElement'
import { Path } from './Path'
import { BrushSetting } from '../Value/BrushSetting'
import { FillSetting } from '../Value/FillSetting'
import { assign, deepClone } from '../utils'

export class VectorObject implements ISilkDOMElement {
  public readonly uid: string = `vectorobj-${v4()}`

  public x: number = 0
  public y: number = 0
  /** 0..360 */
  public rotate: number = 0
  public scale: [number, number] = [1, 1]

  public path: Path = null as any
  public brush: BrushSetting | null = null
  public fill: FillSetting | null = null
  // public appearances: ObjectAppearance[]

  /** Mark for re-rendering decision */
  protected _lastUpdatedAt = Date.now()

  public static create({
    x,
    y,
    path = Path.create({ points: [], closed: false }),
    brush = {
      brushId: '@silk-paint/brush',
      color: { r: 0, g: 0, b: 0 },
      size: 1,
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

  public get lastUpdatedAt() {
    return this._lastUpdatedAt
  }

  public get matrix() {
    const m = new DOMMatrix()
    const bbox = this.getBoundingBox()

    m.translateSelf(bbox.width / 2, bbox.height / 2)
    m.translateSelf(this.x, this.y)
    m.scaleSelf(this.scale[0], this.scale[1])
    m.rotateSelf(0, 0, this.rotate)
    m.translateSelf(-bbox.width / 2, -bbox.height / 2)

    return [m.a, m.b, m.c, m.d, m.e, m.f] as const
  }

  public update(proc: (layer: this) => void) {
    proc(this)
    this._lastUpdatedAt = Date.now()
    // this.emit('updated', this)
  }

  public getBoundingBox() {
    const bbox = this.path.getBoundingBox()
    const left = bbox.left + this.x
    const top = bbox.top + this.y

    return {
      left,
      top,
      right: bbox.right + this.x,
      bottom: bbox.bottom + this.y,
      centerX: left + bbox.width / 2,
      centerY: top + bbox.height / 2,
      width: bbox.width,
      height: bbox.height,
    }
  }

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
