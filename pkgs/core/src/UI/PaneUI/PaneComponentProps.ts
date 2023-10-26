import { VNode } from './AbstractComponent'

export namespace PaneComponentProps {
  type CommonProps = {
    key?: string
  }

  type StyleProps = {
    style?: Record<string, string | number>
  }

  export type Fragment = CommonProps & {
    children?: VNode
  }

  export type View = StyleProps &
    CommonProps & {
      flexFlow?: 'row' | 'column'
      children?: VNode
    }

  export type Text = StyleProps &
    CommonProps & {
      children?: string
    }

  export type Slider = StyleProps &
    CommonProps & {
      value: number
      onChange: (value: number) => void
      min?: number
      max?: number
      step?: number
    }

  export type Button = StyleProps &
    CommonProps & {
      children?: VNode
      onClick?: () => void
    }

  export type TextInput = StyleProps &
    CommonProps & {
      value: string
      onChange: (value: string) => void
    }

  export type BrowserDOM = {
    children?: VNode
  }
}
