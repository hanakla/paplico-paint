import { useFunk } from '@hanakla/arma'
import { Subtract } from '@styled-icons/remix-fill'
import { rgba } from 'polished'
import { memo, ReactNode, useState } from 'react'
import { useToggle } from 'react-use'
import { useDrag } from 'react-use-gesture'

type Props = {
  title: string
  children?: ReactNode
}

export const FloatingWindow = memo(function FloatingWindow({
  title,
  children,
}: Props) {
  const [opened, toggleOpened] = useToggle(false)
  const [referenceImage, setReferenceImage] = useState<string | null>(null)
  const [referencePosition, setReferencePosition] = useState({ x: 200, y: 0 })

  const bindRefDrag = useDrag(({ delta }) => {
    setReferencePosition((s) => ({ x: s.x + delta[0], y: s.y + delta[1] }))
  })

  const handleClickMinimize = useFunk(() => {
    toggleOpened()
  })

  return (
    <div
      css={`
        position: absolute;
        top: 0;
        left: 400px;
        z-index: 1;

        /* height: 300px; */
        padding: 4px;
        overflow: hidden;
        border-radius: 4px;
        background-color: ${rgba('#fff', 0.6)};
      `}
      style={{
        left: referencePosition.x,
        top: referencePosition.y,
        ...(opened ? { width: '300px' } : {}),
      }}
      {...bindRefDrag()}
    >
      <div onDoubleClick={handleClickMinimize}>
        <Subtract width={16} onClick={handleClickMinimize} />
        {title}
      </div>

      <div
        style={
          opened ? { display: 'block', marginTop: '4px' } : { display: 'none' }
        }
      >
        {children}
      </div>
    </div>
  )
})
