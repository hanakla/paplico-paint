export type AbstractComponentRenderer = (
  component: VComponent,
  props: any,
  children: VNode[],
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
  // | ReactPortal
  | boolean
  | null
  | undefined
