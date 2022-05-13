import { LayerTypes } from '@paplico/core/dist/DOM'
import { useTranslation } from 'next-i18next'
import { FakeInput } from './FakeInput'

type Props = {
  name: string
  layerType: LayerTypes['layerType']
  className?: string
}

export const LayerNameText = ({ name, layerType, className }: Props) => {
  const { t } = useTranslation('app')
  return (
    <FakeInput
      css={`
        font-size: 12px;
        pointer-events: none;
        background: transparent;
      `}
      value={name}
      placeholder={`<${t(`layerType.${layerType}`)}>`}
      className={className}
      disabled
    />
  )
}
