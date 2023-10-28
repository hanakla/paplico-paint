import { LayerFilter } from '@/Document'
import { AppearanceRegistry } from './Registry/AppearanceRegistry'
import { BrushRegistry } from './Registry/BrushRegistry'
import { Paplico } from './Paplico'
import { PaneSetState } from '@/UI/PaneUI'
import { ICommand } from '@/History/ICommand'
import { FilterUpdateParameter } from '@/History/Commands/index'

export class PaneUIRenderings {
  protected _pap: Paplico
  protected filterRegistry: AppearanceRegistry
  protected brushRegistry: BrushRegistry
  protected paneImpl: Paplico._PaneImpl

  constructor({
    paplico,
    filterRegistry,
    brushRegistry,
    paneImpl,
  }: {
    paplico: Paplico
    filterRegistry: AppearanceRegistry
    brushRegistry: BrushRegistry
    paneImpl: Paplico._PaneImpl
  }) {
    this._pap = paplico
    this.filterRegistry = filterRegistry
    this.brushRegistry = brushRegistry
    this.paneImpl = paneImpl
  }

  public renderFilterPane(layerUid: string, entry: LayerFilter<any>) {
    const Class = this.filterRegistry.getClass(entry.filterId)
    if (!Class) return null

    const setState: PaneSetState<any> = <T extends Record<string, any>>(
      patchOrFn: Partial<T> | ((prev: T) => T),
    ) => {
      let cmd: ICommand

      if (typeof patchOrFn === 'function') {
        const next = patchOrFn({ ...entry.settings })
        cmd = new FilterUpdateParameter(layerUid, entry.uid, next)
      } else {
        const next = { ...entry.settings, ...patchOrFn }
        cmd = new FilterUpdateParameter(layerUid, entry.uid, next)
      }

      this._pap.command.do(cmd)
    }

    return Class.renderPane({
      c: this.paneImpl.components,
      components: this.paneImpl.components,
      h: this.paneImpl.h,
      state: { ...entry.settings },
      setState,
    })
  }

  public renderBrushPane(
    brushId: string,
    settings: Paplico.StrokeSetting,
    {
      onSettingsChange,
    }: { onSettingsChange: (settings: Paplico.StrokeSetting) => void },
  ) {
    const Class = this.brushRegistry.getClass(brushId)
    if (!Class) return null

    const setState: PaneSetState<any> = <T extends Record<string, any>>(
      patchOrFn: Partial<T> | ((prev: T) => T),
    ) => {
      if (typeof patchOrFn === 'function') {
        const next = patchOrFn({ ...settings.specific })
        onSettingsChange({ ...settings, specific: next })
      } else {
        const next = {
          ...settings,
          specific: { ...settings.specific, ...patchOrFn },
        }
        onSettingsChange(next)
      }
    }

    return Class.renderPane({
      c: this.paneImpl.components,
      components: this.paneImpl.components,
      h: this.paneImpl.h,
      state: { ...Class.getInitialConfig(), ...settings.specific },
      setState,
    })
  }
}
