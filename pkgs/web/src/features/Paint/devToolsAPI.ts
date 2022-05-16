import { StoreGetter } from '@fleur/fleur'
import { EditorSelector } from '../../domains/EditorStable'

export const bindDevToolAPI = (getStore: StoreGetter) => {
  const api = {}

  Object.defineProperties(api, {
    activeLayer: {
      enumerable: true,
      configurable: false,
      get() {
        return EditorSelector.activeLayer(getStore)
      },
    },
    activeObject: {
      enumerable: true,
      configurable: false,
      get() {
        return EditorSelector.activeObject(getStore)
      },
    },
  })
  ;(window as any).paplico = api
}
