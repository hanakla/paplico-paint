import { LayerFilter, VectorExternalAppearanceSetting } from '@/Document'
import { type AppearanceRegistry } from './Registry/AppearanceRegistry'
import { type BrushRegistry } from './Registry/BrushRegistry'
import { type Paplico } from './Paplico'
import { type PaneSetState, type PaplicoComponents } from '@/UI/PaneUI'
import {
  VNode,
  type AbstractElementCreator,
} from '@/UI/PaneUI/AbstractComponent'
import { FilterUpdateParameter } from '@/History/Commands/index'
import { LocaleStrings } from '@/locales'

export namespace PaneUIRenderings {
  /** Passing context object to Brush/Filter#renderPane */
  export type PaneUIContext<T> = Readonly<{
    components: PaplicoComponents
    /** alias of .components */
    c: PaplicoComponents
    /** Current state of your settings */
    settings: T
    /** Update your settings via this function */
    setSettings: PaneSetState<T>
    /** VNode rendering function likes React.createElement or preact's h() */
    h: AbstractElementCreator
    /** Current user locale for render pane */
    locale: Paplico.SupportedLocales
    makeTranslation: <T extends LocaleStrings<any>>(texts: T) => TransFn<T>
  }>

  export type TransFn<T extends LocaleStrings<any>> = {
    <K extends keyof T['en']>(key: K): string

    <K extends keyof T['en'], P extends Record<string, string>>(
      key: K,
      params?: P,
    ): string

    <K extends keyof T['en'], P extends Record<string, string | VNode>>(
      key: K,
      params?: P,
    ): P extends Record<string, infer R>
      ? R extends VNode
        ? VNode
        : string
      : string
  }
}

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

  protected createSetState<T extends Record<string, any>>(
    current: T,
    onStateChange: (next: T) => void,
  ): PaneSetState<T> {
    const setState: PaneSetState<any> = (
      patchOrFn: Partial<T> | ((prev: T) => T),
    ) => {
      const next =
        typeof patchOrFn === 'function'
          ? patchOrFn({ ...current })
          : { ...current, ...patchOrFn }

      onStateChange(next)
    }

    return setState
  }

  protected makeTranslation<T extends LocaleStrings>(
    texts: T,
  ): PaneUIRenderings.TransFn<T> {
    const impl = this.paneImpl
    const localed = texts[this._pap.getPreferences().paneUILocale] as T['en']

    return <K extends keyof T['en']>(
      key: K,
      params: Record<string, string | VNode> = {},
    ): any => {
      const text = localed[key]
      if (!text) return null

      let includesVNode = false
      const children = text
        .split(/(\{\{.+?\}\})/g)
        .map((part, i) => {
          if (!(part.startsWith('{{') && part.endsWith('}}'))) return part

          const key = part.slice(2, -2)
          const value = params[key]

          if (value == null) return null
          if (typeof value !== 'string') {
            includesVNode = true
            return impl.h(impl.components.Fragment, {}, value)
          }

          return value
        })
        .filter(Boolean)

      let next = includesVNode
        ? impl.h(impl.components.Fragment, {}, children)
        : children.join('')

      return next
    }
  }

  public renderFilterPane<
    T extends LayerFilter<any> | VectorExternalAppearanceSetting<any>,
  >(
    layerUid: string,
    entry: T,
    { onSettingsChange }: { onSettingsChange?: (next: T) => void } = {},
  ) {
    const Class = this.filterRegistry.getClass(entry.filterId)
    if (!Class) return null

    const setState = this.createSetState(entry.settings, (next) => {
      onSettingsChange?.(next)

      let cmd = new FilterUpdateParameter(layerUid, entry.uid, next)
      this._pap.command.do(cmd)
    })

    return Class.renderPane({
      c: this.paneImpl.components,
      components: this.paneImpl.components,
      h: this.paneImpl.h,
      settings: { ...entry.settings },
      setSettings: setState,
      locale: this._pap.getPreferences().paneUILocale,
      makeTranslation: this.makeTranslation.bind(this),
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

    const setState = this.createSetState(settings.settings, (next) => {
      onSettingsChange({ ...settings, settings: next })
    })

    return Class.renderPane({
      c: this.paneImpl.components,
      components: this.paneImpl.components,
      h: this.paneImpl.h,
      settings: { ...Class.getInitialConfig(), ...settings.settings },
      setSettings: setState,
      locale: this._pap.getPreferences().paneUILocale,
      makeTranslation: this.makeTranslation.bind(this),
    })
  }
}
