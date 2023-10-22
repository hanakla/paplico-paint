'use client'

import {
  Document,
  Brushes,
  ExtraBrushes,
  Paplico,
  Inks,
} from '@paplico/core-new'
import { useRef } from 'react'
import { useEffectOnce, useUpdate } from 'react-use'
import { css } from 'styled-components'
import { theming } from '../utils/styled'
import { checkerBoard } from '../utils/cssMixin'
import { Listbox, ListboxItem } from '../components/Listbox'
import useEvent from 'react-use-event-hook'
import { EditorArea } from './fragments/EditorArea'
import { usePaplico, usePaplicoInit } from '../domains/paplico'

export default function Index() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const papRef = useRef<Paplico | null>(null)

  usePaplicoInit(canvasRef)

  const handleChangeBrush = useEvent((value: string[]) => {
    const target = papRef.current.brushes.brushEntries.find(
      (entry) => entry.id === value[0],
    )

    papRef.current.strokeSetting = {
      ...papRef.current.strokeSetting,
      brushId: target.id,
      brushVersion: '0.0.1',
      specific: {},
    }
  })

  return (
    <div
      css={css`
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;
        ${theming((o) => [o.bg.surface3])}
      `}
    >
      <div>
        <Listbox
          value={papRef.current ? [papRef.current.strokeSetting.brushId] : []}
          onChange={handleChangeBrush}
        >
          {papRef.current?.brushes.brushEntries.map((entry) => (
            <ListboxItem value={entry.id}>{entry.id}</ListboxItem>
          ))}
        </Listbox>
      </div>

      <div
        css={css`
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        `}
      >
        <EditorArea
          css={css`
            width: 100%;
            height: 100%;
          `}
          ref={canvasRef}
        />
      </div>
    </div>
  )
}
