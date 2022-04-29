import { useStore } from '@fleur/react'
import {
  autoPlacement,
  autoUpdate,
  shift,
  useFloating,
} from '@floating-ui/react-dom'
import { match, useFunk } from '@hanakla/arma'
import { Moon, Sun } from '@styled-icons/remix-fill'
import { rgba } from 'polished'
import { FC, memo, MouseEvent, useEffect } from 'react'
import { css } from 'styled-components'
import {
  ActionSheet,
  ActionSheetItem,
  ActionSheetItemGroup,
} from '🙌/components/ActionSheet'
import { EditorOps, EditorSelector, EditorStore } from '🙌/domains/EditorStable'
import { useFleur } from '🙌/utils/hooks'
import { centering } from '🙌/utils/mixins'
import { darkTheme } from '🙌/utils/theme'
import { usePaplicoExporter } from '../../hooks'

export const AnotherMenus = memo(function AnotherMenus({}: {}) {
  const { execute } = useFleur()
  const { engine, currentTheme, currentDocument } = useStore((get) => ({
    engine: get(EditorStore).state.engine,
    currentTheme: EditorSelector.currentTheme(get),
    currentDocument: EditorSelector.currentDocument(get),
  }))

  const exporter = usePaplicoExporter()

  const float = useFloating({
    strategy: 'absolute',
    placement: 'top-end',
    middleware: [shift()],
  })

  const handleClickExport = useFunk(async () => {
    if (!currentDocument) return
    exporter.exportDocument()
  })

  const handleClickExportAs = useFunk(
    async ({ currentTarget }: MouseEvent<HTMLDivElement>) => {
      const type = currentTarget.dataset.type!
      exporter.exportAs(type as any)
    }
  )

  const handleClickDarkTheme = useFunk(() => {
    execute(EditorOps.setTheme, 'dark')
  })

  const handleClickLightTheme = useFunk(() => {
    execute(EditorOps.setTheme, 'light')
  })

  useEffect(() => {
    float.reference(float.refs.floating.current!.parentElement!)

    if (!float.refs.reference.current || !float.refs.floating.current) return
    autoUpdate(
      float.refs.reference.current,
      float.refs.floating.current,
      float.update
    )
  }, [float.refs.reference, float.refs.floating, float.update])

  return (
    <div
      ref={float.floating}
      css={css`
        padding: 4px 0;
        margin-bottom: 16px;
        background-color: ${({ theme }) => theme.surface.floatWhite};
        border-radius: 4px;
        box-shadow: 0 0 5px ${rgba('#000', 0.5)};
      `}
      style={{
        position: float.strategy,
        left: float.x ?? 0,
        top: float.y ?? 0,
      }}
    >
      <MenuItem>
        保存する
        <ActionSheet opened fill={false}>
          <ActionSheetItemGroup>
            <ActionSheetItem data-type="png" onClick={handleClickExport}>
              ファイルを保存
            </ActionSheetItem>
            {/* <ActionSheetItem data-type="png" onClick={}>ファイルを保存</ActionSheetItem> */}
          </ActionSheetItemGroup>
        </ActionSheet>
      </MenuItem>
      <MenuItem>
        <div
          css={`
            margin-right: 16px;
          `}
        >
          テーマ
        </div>
        <div
          css={css`
            margin-left: auto;
            gap: 4px;
          `}
        >
          <span
            css={`
              padding: 4px 2px;
              border-radius: 64px;
            `}
            style={{
              color:
                currentTheme === 'light'
                  ? darkTheme.exactColors.black40
                  : darkTheme.exactColors.white40,
              backgroundColor:
                currentTheme === 'light'
                  ? darkTheme.exactColors.white40
                  : darkTheme.exactColors.black40,
            }}
            onClick={handleClickDarkTheme}
          >
            <Moon
              css={`
                width: 16px;
              `}
            />
          </span>
          <span
            css={`
              padding: 4px 2px;
              border-radius: 64px;
            `}
            style={{
              color:
                currentTheme === 'dark'
                  ? darkTheme.exactColors.black40
                  : darkTheme.exactColors.white40,
              backgroundColor:
                currentTheme === 'dark'
                  ? darkTheme.exactColors.white40
                  : darkTheme.exactColors.black40,
            }}
            onClick={handleClickLightTheme}
          >
            <Sun
              css={`
                width: 16px;
              `}
            />
          </span>
        </div>
      </MenuItem>
    </div>
  )
})

const MenuItem: FC = ({ children }) => {
  return (
    <div
      css={`
        display: flex;
        padding: 4px 8px;
      `}
    >
      {children}
    </div>
  )
}
