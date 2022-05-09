import { PointerSensor } from '@dnd-kit/core'
import { PointerEvent } from 'react'
import { DOMUtils } from '../../utils/dom'

export class DisableOnInputPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: ({ nativeEvent: event }: PointerEvent<Element>) => {
        return !DOMUtils.closestOrSelf(
          event.target,
          'input, textarea, selectbox'
        )
      },
    },
  ]
}
