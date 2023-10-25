import {
  VComponent,
  VComponentProps,
  VElement,
  VNode,
} from './AbstractComponent'
import { PaneComponentProps } from './PaneComponentProps'

export type { VComponent, VElement, VNode }

export interface PaplicoComponents {
  Fragment: VComponent<PaneComponentProps.Fragment>
  View: VComponent<PaneComponentProps.View>
  Text: VComponent<PaneComponentProps.Text>
  Slider: VComponent<PaneComponentProps.Slider>
  Button: VComponent<PaneComponentProps.Button>
  TextInput: VComponent<PaneComponentProps.TextInput>
  BrowserDOM: VComponent<PaneComponentProps.BrowserDOM>
}

type SetState<T> = {
  (state: Partial<T>, replace?: false): void
  (state: T, replace: true): void
  (state: (prev: T) => T): void
}

export type PaneContext<T> = {
  components: PaplicoComponents
  c: PaplicoComponents
  state: T
  setState: SetState<T>
  h: <T extends VComponent<any>>(
    Component: T,
    props: VComponentProps<T>,
    ...children: VNode[]
  ) => any
}

export { ReactDOMImpls } from './ReactDOM/index'
export { NoneImpls } from './None/index'
