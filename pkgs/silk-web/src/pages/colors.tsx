import { createGlobalStyle, ThemeProvider } from 'styled-components'
import { light, dark } from '@charcoal-ui/theme'
import { useFunk } from '@hanakla/arma'
import { useToggle } from 'react-use'
import { ChangeEvent } from 'react'
import { useFunkyGlobalMouseTrap } from '🙌/hooks/useMouseTrap'

export default function Colors() {
  const [isLight, toggle] = useToggle(true)
  const theme = isLight ? light : dark

  const themeChanged = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) =>
      toggle(currentTarget.value === 'light' ? true : false)
  )

  useFunkyGlobalMouseTrap(['x'], () => toggle())

  return (
    <ThemeProvider theme={isLight ? light : dark}>
      <Global text={theme.color.text1} bg={theme.color.surface1} />
      <div
        css={`
          width: 50vw;
          margin: 0 auto;
        `}
        style={{ backgroundColor: theme.color.surface1 }}
      >
        <div
          css={`
            margin: 8px 0;
          `}
        >
          <label>
            <input
              type="radio"
              name="theme"
              value="light"
              onChange={themeChanged}
              checked={isLight}
            />
            Light
          </label>
          <label>
            <input
              type="radio"
              name="theme"
              value="dark"
              onChange={themeChanged}
              checked={!isLight}
            />
            Dark
          </label>
        </div>

        <div
          css={`
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 8px;
          `}
        >
          <Color color={theme.color.text1} name="text1" />
          <Color color={theme.color.text2} name="text2" />
          <Color color={theme.color.text3} name="text3" />
          <Color color={theme.color.text4} name="text4" />
          <Color color={theme.color.text5} name="text5" />
          <div></div>

          <Color color={theme.color.surface1} name="surface1" />
          <Color color={theme.color.surface2} name="surface2" />
          <Color color={theme.color.surface3} name="surface3" />
          <Color color={theme.color.surface4} name="surface4" />
          <Color color={theme.color.surface6} name="surface6" />
          <Color color={theme.color.surface7} name="surface7" />

          <Color color={theme.color.surface8} name="surface8" />
          <Color color={theme.color.surface9} name="surface9" />
          <div />
          <div />
          <div />
          <div />
        </div>
      </div>
    </ThemeProvider>
  )
}

const Global = createGlobalStyle<{ text: string; bg: string }>`
  html {
    color:  ${({ text }) => text};
    background-color:  ${({ bg }) => bg};
  }
`

const Color = ({ name, color }: { name: string; color: string }) => {
  return (
    <div>
      <div
        css={`
          &::before {
            content: '';
            display: block;
            padding-top: 100%;
          }
        `}
        style={{ backgroundColor: color }}
      />
      <div>{name}</div>
    </div>
  )
}
