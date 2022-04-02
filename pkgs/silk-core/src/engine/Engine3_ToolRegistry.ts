import { SilkEngine3 } from './Engine3'
import { BrushClass, IBrush } from './IBrush'
import { FilterClass, IFilter } from './IFilter'

export class ToolRegistry {
  protected brushRegister = new Map<string, BrushClass>()
  protected brushInstances = new WeakMap<BrushClass, IBrush>()

  protected filterRegister = new Map<string, FilterClass>()
  protected filterInstances = new WeakMap<FilterClass, IFilter>()

  constructor(protected engine: SilkEngine3) {}

  public async registerBrush(Brush: BrushClass) {
    this.brushRegister.set(Brush.id, Brush)

    const brush = new Brush()
    await brush.initialize({ gl: this.engine.gl })
    this.brushInstances.set(Brush, brush)
  }

  public get registeredBrushes() {
    return [...this.brushRegister.values()]
  }

  public getBrushInstance(id: string) {
    const Class = this.brushRegister.get(id)
    if (!Class) return null

    return this.brushInstances.get(Class) ?? null
  }

  public async registerFilter(Filter: FilterClass) {
    this.filterRegister.set(Filter.id, Filter)

    const filter = new Filter()
    await filter.initialize({ gl: this.engine.gl })
    this.filterInstances.set(Filter, filter)
  }

  public get registeredFilters() {
    return [...this.filterRegister.values()]
  }

  public getFilterInstance(id: string) {
    const Class = this.filterRegister.get(id)
    if (!Class) return null

    return this.filterInstances.get(Class) ?? null
  }
}
