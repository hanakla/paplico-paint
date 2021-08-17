import { assign, deepClone } from '../utils'
import { v4 } from 'uuid'

export class Filter {
  public id: string = `filter-${v4()}`
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
      id: obj.id,
      filterId: obj.filterId,
      setttings: obj.setttings,
    })
  }

  public serialize() {
    return {
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
