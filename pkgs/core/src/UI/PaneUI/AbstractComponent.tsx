export type AbstractComponentRenderer = <T extends VComponent<any>>(
  component: T,
  props: VComponentProps<T>,
  ...children: VNode[]
) => VNode

export type StyleProp = {
  style: Record<string, string | number>
}

export type VComponentProps<C extends VComponent<any>> = C extends VComponent<
  infer P
>
  ? P
  : never

export type VComponent<P = {}> = (props: P) => VNode
export type VElement = JSX.Element
export type VNode =
  | VElement
  | string
  | number
  | Iterable<VNode>
  // | { children?: VNode | undefined } // as Portal
  | boolean
  | null
  | undefined
