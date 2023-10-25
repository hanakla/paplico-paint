import { VNode } from './AbstractComponent'

export namespace PaneComponentProps {
  export type StyleProps = {
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
