import Fleur, { AppContext } from '@fleur/fleur'
import { AppStore } from './App'
import { EditorStore } from './EditorStable'
import { NotifyStore } from './Notify'

const app = new Fleur({
  stores: [AppStore, EditorStore, NotifyStore],
})

export const createContext = () => {
  const context = app.createContext()
  return context
  // return withReduxDevTools(context)
}

const withReduxDevTools = (context: AppContext): AppContext => {
  // Ignore in SSR environment
  if (typeof window === 'undefined') return context
  if (!(window as any).__REDUX_DEVTOOLS_EXTENSION__) return context

  const devTools = (window as any).__REDUX_DEVTOOLS_EXTENSION__.connect()
  devTools.subscribe(({ type, payload, state }: any) => {
    if (type !== 'DISPATCH') return

    // if (!enableTimeTravel) {
    //   console.log('[fleur-redux-devtools] Time traveling is disabled')
    //   return
    // }

    // if (payload.type === 'TOGGLE_ACTION') {
    //   console.log("[fleur-redux-devtools] Skip action doesn't supported.")
    //   return
    // }

    // const stores = JSON.parse(state)
    // context.rehydrate({ stores })
    // context.stores.forEach((store) => store.emitChange())
  })

  const dispatch = context.dispatch
  context.dispatch = (actionIdentifier: any, payload: any) => {
    dispatch(actionIdentifier, payload)

    devTools.send(
      { type: actionIdentifier.name, payload },
      stringifyEffort(context.dehydrate().stores)
    )
  }

  return context
}

const stringifyEffort = (o: any) => {
  const objectify = (o: any): any => {
    if (typeof o !== 'object' || o === null) return o

    const proto = Object.getPrototypeOf(o)
    console.log(proto)
    if (proto !== Object && proto !== null)
      return `[object ${o[Symbol.toStringTag]}]`

    if (o instanceof Array) {
      return o.map((e) => objectify(e))
    } else {
      return Object.keys(o).reduce(
        (a, k) => Object.assign(a[k], objectify(o[k])),
        Object.create(null)
      )
    }
  }

  return JSON.stringify(objectify(o))
}
