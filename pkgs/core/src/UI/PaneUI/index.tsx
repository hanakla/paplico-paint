import {
  VComponent,
  VComponentProps,
  VElement,
  VNode,
} from './AbstractComponent'
import { PaneComponentProps } from './PaneComponentProps'

export type { VComponent, VElement, VNode, PaneComponentProps }

export interface PaplicoComponents {
  Fragment: VComponent<PaneComponentProps.Fragment>
  View: VComponent<PaneComponentProps.View>
  Text: VComponent<PaneComponentProps.Text>
  Slider: VComponent<PaneComponentProps.Slider>
  Button: VComponent<PaneComponentProps.Button>
  TextInput: VComponent<PaneComponentProps.TextInput>
  BrowserDOM: VComponent<PaneComponentProps.BrowserDOM>
}

export type PaneSetState<T> = {
  (state: Partial<T>): void
  (state: (prev: T) => T): void
}

export { ReactDOMImpls } from './ReactDOM/index'
export { NoneImpls } from './None/index'
