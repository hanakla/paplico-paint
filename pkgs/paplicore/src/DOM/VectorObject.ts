import { v4 } from 'uuid'
// import DOMMatrix from 'dommatrix'
import { Emitter } from '../Engine3_Emitter'

import { ISilkDOMElement } from './ISilkDOMElement'
import { Path } from './Path'
import { BrushSetting } from '../Value/BrushSetting'
import { FillSetting } from '../Value/FillSetting'
import { assign, deepClone } from '../utils'

export declare namespace VectorObject {
  interface Attributes {
    x: number
    y: number
    visible: boolean
    lock: boolean
    /** 0..360 */
    rotate: number
    scale: [number, number]
    brush: BrushSetting | null
    fill: FillSetting | null
  }

  interface SerializedAttibutes extends Attributes {
    uid: string
    path: Path.SerializedAttibutes
  }
}

type Events = {
  updated: VectorObject
}

export class VectorObject
  extends Emitter<Events>
  implements ISilkDOMElement, VectorObject.Attributes
{
  public readonly uid: string = `vectorobj-${v4()}`

  public x: number = 0
  public y: number = 0
  public visible: boolean = true
  public lock: boolean = false

  /** 0..360 */
  public rotate: number = 0
  public scale: [number, number] = [1, 1]

  public path: Path = null as any
  public brush: BrushSetting | null = null
  public fill: FillSetting | null = null
  // public appearances: ObjectAppearance[]

  /** Mark for re-rendering decision */
  protected _contentUpdatedAt = Date.now()

  public static create({
    x,
    y,
    path = Path.create({ points: [], closed: false }),
    brush = {
      brushId: '@paplico/brushes/brush',
      color: { r: 0, g: 0, b: 0 },
      size: 1,
      opacity: 1,
      specific: null,
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

  public static deserialize(obj: VectorObject.SerializedAttibutes) {
    return assign(new VectorObject(), {
      uid: obj.uid,
      x: obj.x,
      y: obj.y,
      rotate: obj.rotate ?? 0,
      scale: obj.scale ?? [1, 1],
      visible: obj.visible ?? true,
      lock: obj.lock,
      path: Path.deserialize(obj.path),
      brush: obj.brush,
      fill: obj.fill,
    })
  }

  protected constructor() {
    super()
  }

  public get lastUpdatedAt() {
    return this._contentUpdatedAt
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

  // public boolean = {
  //   intoAdd: (object: VectorObject) => {
  //     const a = new Paper.Path(this.path.svgPath)
  //     const b = new Paper.Path(object.path.svgPath)

  //     console.log(a.unite(b).exportSVG({ asString: true }))
  //   },
  // }

  public update(proc: (object: this) => void) {
    proc(this)
    this.emit('updated', this)
    this._contentUpdatedAt = Date.now()
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

  public serialize(): VectorObject.SerializedAttibutes {
    return {
      uid: this.uid,
      x: this.x,
      y: this.y,
      rotate: this.rotate,
      scale: this.scale,
      visible: this.visible,
      lock: this.lock,
      path: this.path.serialize(),
      brush: deepClone(this.brush),
      fill: deepClone(this.fill),
    }
  }
}
