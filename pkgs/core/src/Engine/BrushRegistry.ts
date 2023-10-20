import { Emitter } from '@/utils/Emitter'
import { catchToLog } from '@/utils/error'
import { BrushClass, IBrush } from './Brush'

type Events = {
  entriesChanged: void
}

export class BrushRegistry extends Emitter<Events> {
  protected brushes: Map<string, BrushClass> = new Map()
  protected instances: WeakMap<BrushClass, IBrush> = new WeakMap()

  public async register(Brush: BrushClass) {
    try {
      this.brushes.set(Brush.id, Brush)

      const brush = new Brush()
      await brush.initialize({ gl: this.gl })

      this.instances.set(Brush, brush)
    } catch (e) {
      this.brushes.delete(Brush.id)
      this.instances.delete(Brush)
      console.warn('Failed to register brush', Brush, e)
      throw e
    }

    this.emit('entriesChanged')
  }

  public get brushEntries(): BrushClass[] {
    return [...this.brushes.values()]
  }

  public getInstance(id: string): IBrush | null {
    const Class = this.brushes.get(id)
    if (!Class) return null

    return this.instances.get(Class) ?? null
  }
}
