import { Emitter } from '@/utils/Emitter'
import { AppearanceClass, IAppearance } from '../Appearance'

type Events = {
  entriesChanged: void
}

export class AppearanceRegistry extends Emitter<Events> {
  protected appearances: Map<string, AppearanceClass> = new Map()
  protected instances: WeakMap<AppearanceClass, IAppearance> = new WeakMap()

  public async register(Brush: AppearanceClass) {
    try {
      this.appearances.set(Brush.id, Brush)

      const appear = new Brush()
      await appear.initialize({ gl: this.gl })

      this.instances.set(Brush, appear)
    } catch (e) {
      this.appearances.delete(Brush.id)
      this.instances.delete(Brush)
      console.warn('Failed to register brush', Brush, e)
      throw e
    }

    this.emit('entriesChanged')
  }

  public get appearanceEntries(): AppearanceClass[] {
    return [...this.appearances.values()]
  }

  public getInstance(id: string): IAppearance | null {
    const Class = this.appearances.get(id)
    if (!Class) return null

    return this.instances.get(Class) ?? null
  }
}
