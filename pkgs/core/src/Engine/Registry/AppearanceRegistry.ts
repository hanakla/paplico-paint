import { Emitter } from '@paplico/shared-lib'
import { FilterClass, IFilter } from '../Filter/Filter'

type Events = {
  entriesChanged: void
}

export class AppearanceRegistry extends Emitter<Events> {
  protected filters: Map<string, FilterClass<any>> = new Map()
  protected instances: WeakMap<FilterClass<any>, IFilter<any>> = new WeakMap()

  public async register(Brush: FilterClass<any>) {
    try {
      this.filters.set(Brush.metadata.id, Brush)

      const filter = new Brush()
      await filter.initialize({})

      this.instances.set(Brush, filter)
    } catch (e) {
      this.filters.delete(Brush.metadata.id)
      this.instances.delete(Brush)
      console.warn('Failed to register brush', Brush, e)
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
