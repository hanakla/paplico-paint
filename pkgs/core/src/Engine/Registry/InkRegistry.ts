import { Emitter } from '@/utils/Emitter'
import { IInk, InkClass } from '../Ink'

type Events = {
  entriesChanged: void
}

export class InkRegistry extends Emitter<Events> {
  protected brushes: Map<string, InkClass<any>> = new Map()
  protected instances: WeakMap<InkClass<any>, IInk<any>> = new WeakMap()

  public async register(Brush: InkClass<any>) {
    try {
      this.brushes.set(Brush.metadata.id, Brush)

      const brush = new Brush()
      await brush.initialize()

      this.instances.set(Brush, brush)
    } catch (e) {
      this.brushes.delete(Brush.metadata.id)
      this.instances.delete(Brush)
      throw e
    }

    this.emit('entriesChanged')
  }

  public get entries(): InkClass<any>[] {
    return [...this.brushes.values()]
  }

  public getInstance(id: string): IInk<any> | null {
    const Class = this.brushes.get(id)
    if (!Class) return null

    return this.instances.get(Class) ?? null
  }
}
