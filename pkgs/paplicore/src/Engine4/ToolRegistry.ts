import { BrushClass, IBrush } from '../engine/IBrush'
import { FilterClass, IFilter } from '../engine/IFilter'
import { WebGLContext } from './WebGLContext'

export class ToolRegistry {
  protected brushRegister = new Map<string, BrushClass>()
  protected brushInstances = new WeakMap<BrushClass, IBrush>()

  protected filterRegister = new Map<string, FilterClass>()
  protected filterInstances = new WeakMap<FilterClass, IFilter>()

  public async registerBrush(Brush: BrushClass) {
    this.brushRegister.set(Brush.id, Brush)
  }

  public get registeredBrushes() {
    return [...this.brushRegister.values()]
  }

  public getBrushClass(id: string) {
    return this.brushRegister.get(id) ?? null
  }

  public async getBrushInstance(id: string, gl: WebGLContext) {
    const BrushClass = this.brushRegister.get(id)
    if (!BrushClass) return null

    let instance = this.brushInstances.get(BrushClass)
    if (!instance) {
      instance = new BrushClass()
      await instance.initialize({ gl })
    }

    this.brushInstances.set(BrushClass, instance)
    return instance
  }

  public async registerFilter(Filter: FilterClass) {
    this.filterRegister.set(Filter.id, Filter)
  }

  public get registeredFilters() {
    return [...this.filterRegister.values()]
  }

  public getFilterClass(id: string) {
    return this.filterRegister.get(id) ?? null
  }

  public async getFilterInstance(id: string, gl: WebGLContext) {
    const FilterClass = this.filterRegister.get(id)
    if (!FilterClass) return null

    let instance = this.filterInstances.get(FilterClass)
    if (!instance) {
      instance = new FilterClass()
      await instance.initialize({ gl })
    }

    this.filterInstances.set(FilterClass, instance)
    return instance
  }
}
