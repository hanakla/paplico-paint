import { ChangeEvent, useCallback, useContext, useReducer, useState } from "react";
import { ChromePicker, ColorChangeHandler } from 'react-color'
import {rgba } from 'polished'
import { EngineContext } from "../lib/EngineContext";

export function BrushView() {
  const engine = useContext(EngineContext)
  const [color, setColor] = useState({ r:0, g:0, b: 0 })
  const [openPicker, togglePicker] = useReducer(next => !next, false)
  const [weight, setWeight] = useState(1)

  const handleChangeColor: ColorChangeHandler = useCallback((color) => {
    setColor(color.rgb)

    engine.brushSetting = {
      ...engine.brushSetting,
      color: color.rgb,
    }
  }, [])

  const handleChange = useCallback(({currentTarget}: ChangeEvent<HTMLInputElement>) => {
    setWeight(currentTarget.valueAsNumber)

    engine.brushSetting = {
      ...engine.brushSetting,
      weight: currentTarget.valueAsNumber
    }
  }, [engine])

  return (
    <div
      css={`
        display: flex;
        gap: 8px;
        padding: 8px 16px;
        background-color: #ccc;
        border-radius: 100px;
        color: #464b4e;
        border: 1px solid #aaa;
        white-space: nowrap;
      `}
    >
      <div>
        <span css="margin-right: 4px">太さ</span>
        <input css="vertical-align: bottom;" type='range' min="0" max='100' step="0.1" value={weight} onChange={handleChange} />
      </div>

      <div>
        <span css="margin-right: 4px">色</span>
        <div
          css={`
            display: inline-block;
            position: relative;
            width: 30px;
            height: 30px;
            border-radius: 100px;
            border: 2px solid #dbdbdb;
            vertical-align: middle;
            box-shadow: 0 0 2px 1px rgba(0,0,0,.4);
          `}
          style={{backgroundColor: rgba(color.r, color.g, color.b, 1) }}
          onClick={togglePicker}
        >
          {openPicker && (
            <ChromePicker
              css={`
                position: absolute;
                left:50%;
                bottom: 100%;
                transform: translateX(-50%);
              `}
              color={color}
              onChangeComplete={handleChangeColor}
            />
          )}
        </div>
      </div>

      <div>
        <span css="margin-right: 4px">インク</span>
        <div></div>
      </div>
    </div>
  )
}
