import { Emitter } from '@paplico/shared-lib'
import { FilterClass, IFilter } from '../Filter/Filter'
import { WebGLFilterContext } from '../Filter/WebGLFilterContext'

type Events = {
  entriesChanged: void
}

export class AppearanceRegistry extends Emitter<Events> {
  protected filters: Map<string, FilterClass<any>> = new Map()
  protected instances: WeakMap<FilterClass<any>, IFilter<any>> = new WeakMap()

  constructor(protected gl: WebGLFilterContext) {
    super()
  }

  public async register(Class: FilterClass<any>) {
    try {
      this.filters.set(Class.metadata.id, Class)

      const filter = new Class()
      await filter.initialize({ gl: this.gl })

      this.instances.set(Class, filter)
    } catch (e) {
      this.filters.delete(Class.metadata.id)
      this.instances.delete(Class)
      console.warn('Failed to register filter', Class.metadata.id, e)
      throw e
    }

    this.emit('entriesChanged')
  }

  public get entries(): FilterClass<any>[] {
    return [...this.filters.values()]
  }

  public getClass<T extends FilterClass<any> = FilterClass<any>>(
    id: string,
  ): T | null {
    return (this.filters.get(id) as T | undefined) ?? null
  }

  public getInstance<T extends IFilter<any> = IFilter<any>>(
    id: string,
  ): T | null {
    const Class = this.filters.get(id)
    if (!Class) return null

    return (this.instances.get(Class) as T | undefined) ?? null
  }
}
