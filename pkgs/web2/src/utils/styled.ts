import { CharcoalTheme } from '@charcoal-ui/theme'
import { createTheme } from '@charcoal-ui/styled'
import styled, { css } from 'styled-components'

export const theming = createTheme<CharcoalTheme>(styled)

export function styleWhen(predicate: boolean) {
  return {
    css: (str: TemplateStringsArray, ...args: any[]) => {
      return predicate ? css(str, ...args) : ''
    },
  }
}
