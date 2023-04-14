import { Emitter } from '@/utils/Emitter'
import { IInk, InkClass } from './Ink'

type Events = {
  entriesChanged: void
}

export class InkRegistry extends Emitter<Events> {
  protected brushes: Map<string, InkClass> = new Map()
  protected instances: WeakMap<InkClass, IInk> = new WeakMap()

  public async register(Brush: InkClass) {
    try {
      this.brushes.set(Brush.id, Brush)

      const brush = new Brush()
      await brush.initialize()

      this.instances.set(Brush, brush)
    } catch (e) {
      this.brushes.delete(Brush.id)
      this.instances.delete(Brush)
      throw e
    }

    this.emit('entriesChanged')
  }

  public get brushEntries(): InkClass[] {
    return [...this.brushes.values()]
  }

  public getInstance(id: string): IInk | null {
    const Class = this.brushes.get(id)
    if (!Class) return null

    return this.instances.get(Class) ?? null
  }
}
