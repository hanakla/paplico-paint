import { v4 } from 'uuid'

export class Filter {
  public id: string = `filter-${v4()}`
  public filterId: string = ''

  public settings: Record<string, any> = {}

  public serialize() {
    return { ...this }
  }
}

export namespace Filter {
  export class ContentInHere {
    public static id: '@silk-core/content-in-here'
  }
}
