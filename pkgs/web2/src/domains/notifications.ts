import { Emitter } from '@/utils/emitter'
import { RasterToolModes, VectorToolModes } from '@paplico/editor'
import { useEffect } from 'react'

export type Notifications =
  | {
      type: 'toolChanged'
      tool: VectorToolModes | RasterToolModes
    }
  | {
      type: 'undo'
    }
  | {
      type: 'redo'
    }

const emitter = new Emitter<{
  notify: Notifications
}>()

export const notificationStore = {
  emit(notify: Notifications) {
    emitter.emit('notify', notify)
  },
}

export const useNotifyStore = () => {
  return notificationStore
}

export const useNotifications = (listener: (notify: Notifications) => void) => {
  useEffect(() => {
    return emitter.on('notify', (notify) => {
      listener(notify)
    })
  })
}
