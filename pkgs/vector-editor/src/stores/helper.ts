import { StoreApi } from 'zustand'

// Zustand patching for optional selector type
export type BoundedUseStore<S extends StoreApi<any>> = {
  (): ExtractState<S>
  <U = void>(
    selector?: (state: ExtractState<S>) => U,
  ): U extends void ? ExtractState<S> : U
}

type ExtractState<S> = S extends {
  getState: () => infer T
}
  ? T
  : never
