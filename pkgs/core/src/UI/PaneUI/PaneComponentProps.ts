import { CSSProperties } from 'react'
import { VNode } from './AbstractComponent'

export namespace PaneComponentProps {
  type StyleProps = {
    style?: Partial<{
      position: 'relative' | 'absolute'
      left: CSSProperties['left']
      top: CSSProperties['top']
      right: CSSProperties['right']
      bottom: CSSProperties['bottom']
      display: 'flex' | 'none'
      width: CSSProperties['width']
      height: CSSProperties['height']
      gap: CSSProperties['gap']
      overflow: 'visible' | 'hidden' | 'scroll'
      flexGrow: CSSProperties['flexGrow']
      flexShrink: CSSProperties['flexShrink']
      flexBasis: CSSProperties['flexBasis']
      flexFlow: CSSProperties['flexFlow']
      flexDirection: CSSProperties['flexDirection']
      flexWrap: CSSProperties['flexWrap']
      alignItems: CSSProperties['alignItems']
      justifyContent: CSSProperties['justifyContent']
      margin: CSSProperties['margin']
      marginLeft: CSSProperties['marginLeft']
      marginTop: CSSProperties['marginTop']
      marginRight: CSSProperties['marginRight']
      marginBottom: CSSProperties['marginBottom']
      padding: CSSProperties['padding']
      paddingLeft: CSSProperties['paddingLeft']
      paddingTop: CSSProperties['paddingTop']
      paddingRight: CSSProperties['paddingRight']
      paddingBottom: CSSProperties['paddingBottom']
      zIndex: CSSProperties['zIndex']
    }>
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
    inputs: VNode
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
