import { BrushClass, IBrush } from '../Brush/Brush'
import { Emitter } from '@paplico/shared-lib'
import { catchToLog } from '@/utils/error'

interface Events {
  entriesChanged: void
}

export class BrushRegistry extends Emitter<Events> {
  protected brushes = new Map<string, BrushClass>()
  protected instances = new WeakMap<BrushClass, IBrush>()

  public async register(Brush: BrushClass) {
    try {
      this.brushes.set(Brush.metadata.id, Brush)

      const brush = new Brush()
      await brush.initialize({ gl: this.gl })

      this.instances.set(Brush, brush)
    } catch (e) {
      this.brushes.delete(Brush.metadata.id)
      this.instances.delete(Brush)
      console.error('Failed to register brush', Brush, e)
      throw e
    }

    this.emit('entriesChanged')
  }

  public get entries(): BrushClass[] {
    return [...this.brushes.values()]
  }

  public getClass<T extends BrushClass<any> = BrushClass<any>>(
    id: string,
  ): T | null {
    return (this.brushes.get(id) as T | undefined) ?? null
  }

  public getInstance(id: string): IBrush | null {
    const Class = this.brushes.get(id)
    if (!Class) return null

    return this.instances.get(Class) ?? null
  }
}
