import { v4 } from 'uuid'
import { assign, deepClone } from '../utils'
import { ISilkDOMElement } from './ISilkDOMElement'

export class Filter implements ISilkDOMElement {
  public uid: string = `filter-${v4()}`
  public filterId: string = ''

  public visible: boolean = true
  public settings: Record<string, any> = {}

  public static create({
    filterId,
    settings,
    visible = true,
  }: {
    filterId: string
    settings: Record<string, any>
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
  }

  public serialize() {
    return {
      uid: this.uid,
      filterId: this.filterId,
      setttings: deepClone(this.settings),
    }
  }
}

export namespace Filter {
  export class ContentInHereMark {
    public static id: '@silk-core/content-in-here-mark'
  }
}
