import { v4 } from 'uuid'
import { Emitter } from '../Engine3_Emitter'
import { assign, deepClone } from '../utils/object'
import { ISilkDOMElement } from './ISilkDOMElement'

export declare namespace Filter {
  export type Attributes = {
    filterId: string
    visible: boolean
    settings: Record<string, any>
  }

  export type PatchableAttributes = Omit<Attributes, 'filterId'>

  // export class ContentInHereMark {
  //   public static id: '@paplico/internal-filters/content-in-here-mark'
  // }
}

type Events = {
  updated: Filter
}

export class Filter
  extends Emitter<Events>
  implements ISilkDOMElement, Filter.Attributes
{
  public static readonly patchableAttributes: readonly (keyof Filter.Attributes)[] =
    Object.freeze(['visible', 'settings'])

  public uid: string = `filter-${v4()}`
  public filterId: string = ''

  public visible: boolean = true
  public settings: Record<string, any> = {}

  public static create<FiterSettingType = Record<string, any>>({
    filterId,
    settings,
    visible = true,
  }: {
    filterId: string
    settings: FiterSettingType
    visible?: boolean
  }) {
    return assign(new Filter(), { filterId, settings, visible })
  }

  public static deserialize(obj: any) {
    return assign(new Filter(), {
      uid: obj.uid,
      filterId: obj.filterId,
      settings: obj.setttings,
    })
  }

  public update(proc: (entity: this) => void) {
    proc(this)
    this.emit('updated', this)
  }

  public serialize() {
    return {
      uid: this.uid,
      filterId: this.filterId,
      setttings: deepClone(this.settings),
    }
  }
}
