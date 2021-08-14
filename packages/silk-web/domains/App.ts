import {
  actions,
  action,
  reducerStore,
  operations,
  selector,
} from '@fleur/fleur'

export const AppActions = actions('Counter', {
  increment: action<{ amount: number }>(),
  accessDateSettled: action<{ date: Date }>(),
})

export const AppOps = operations({
  setCurrentTool({ dispatch }) {},
})

interface State {
  count: number
  accessDate: Date | null
  // currentTool
}

export const AppStore = reducerStore<State>('AppStore', () => ({
  count: 0,
  accessDate: null,
}))
  .listen(AppActions.increment, (draft, { amount }) => (draft.count += amount))
  .listen(
    AppActions.accessDateSettled,
    (draft, { date }) => (draft.accessDate = date)
  )

export const AppSelectors = {
  getCount: selector((getState) => getState(AppStore).count),
  getAccessDate: selector((getState) => getState(AppStore).accessDate),
}
