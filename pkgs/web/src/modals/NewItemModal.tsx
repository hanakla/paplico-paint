import { ModalComponentType } from '@fleur/mordred'
import styled from 'styled-components'
import { useFunk, useObjectState } from '@hanakla/arma'
import useMeasure from 'use-measure'

import { Button } from '../components/Button'
import { FakeInput } from '../components/FakeInput'
import { ModalBase } from '../components/ModalBase'
import { Stack } from '../components/Stack'
import { TextInput } from '../components/TextInput'
import { ThemeProp, tm } from '../utils/theme'
import { useRef } from 'react'
import { fit } from 'object-fit-math'
import { media } from '../utils/responsive'
import { rgba } from 'polished'
import { centering } from '../utils/mixins'

export const NewItemModal: ModalComponentType<
  { defaultSize: { width: number; height: number } },
  { width: number; height: number } | null
> = ({ defaultSize, onClose }) => {
  const [inputs, setInputs] = useObjectState({ ...defaultSize })

  const previewRef = useRef<HTMLDivElement | null>(null)
  const bbox = useMeasure(previewRef)
  const previewSize = fit(bbox, inputs, 'contain')

  const handleClickCancel = useFunk(() => {
    onClose(null)
  })

  const handleClickSubmit = useFunk(() => {
    onClose(inputs)
  })

  return (
    <ModalBase
      header={
        <>
          <h1>Header</h1>
        </>
      }
      content={
        <>
          <Stack dir="vertical">
            <Stack dir="horizontal" narrowDir="vertical" gap={16}>
              <InputSection>
                <label>幅</label>
                <TextInput
                  type="number"
                  value={inputs.width}
                  onChange={({ currentTarget }) =>
                    setInputs({ width: currentTarget.valueAsNumber })
                  }
                />
              </InputSection>

              <InputSection>
                <label>高さ</label>
                <TextInput
                  type="number"
                  value={inputs.height}
                  onChange={({ currentTarget }) =>
                    setInputs({ height: currentTarget.valueAsNumber })
                  }
                />
              </InputSection>
            </Stack>

            <div
              ref={previewRef}
              css={`
                ${centering()}
                width: 100%;
                min-height: 300px;
                padding: 4px;
                background-color: ${rgba('#ddd', 0.5)};
              `}
            >
              <div
                css={`
                  ${centering()}
                  text-align: center;
                  padding: 8px;
                  border: 2px solid ${rgba('#aaa', 0.5)};
                  border-radius: 8px;
                  background-color: #fff;
                `}
                style={{ width: previewSize.width, height: previewSize.height }}
              >
                {inputs.width}px
                <br />
                ×<br />
                {inputs.height}px
              </div>
            </div>
          </Stack>
        </>
      }
      footer={
        <Stack dir="horizontal" gap={16} justify="end">
          <Button kind="normal" onClick={handleClickCancel}>
            キャンセル
          </Button>
          <Button kind="primary" onClick={handleClickSubmit}>
            作成
          </Button>
        </Stack>
      }
    />
  )
}

const InputSection = styled.label`
  display: block;

  label {
    display: block;
    margin-bottom: 4px;
    ${tm((o) => o.typography(12).bold)};
  }
`
