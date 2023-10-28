import { VNode } from './AbstractComponent'

export namespace PaneComponentProps {
  type StyleProps = {
    style?: Record<string, string | number>
  }

  export type Fragment = {
    children?: VNode
  }

  export type View = StyleProps & {
    flexFlow?: 'row' | 'column'
    children?: VNode
  }

  export type Text = StyleProps & {
    children?: string
  }

  export type FieldSet = StyleProps & {
    title: string
    postTitle?: VNode
    displayValue?: VNode
    input: VNode
  }

  export type SelectBox = StyleProps & {
    placeholder?: string
    value: string | readonly string[] | undefined
    items: ReadonlyArray<{
      label?: string
      value: string
    }>
    onChange: (value: string) => void
  }

  export type Slider = StyleProps & {
    value: number
    onChange: (value: number) => void
    min?: number
    max?: number
    step?: number
  }

  export type Button = StyleProps & {
    children?: VNode
    onClick?: () => void
  }

  export type TextInput = StyleProps & {
    value: string
    onChange: (value: string) => void
  }

  export type BrowserDOM = {
    children?: VNode
  }
}
