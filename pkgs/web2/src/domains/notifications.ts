import { Emitter } from '@/utils/emitter'
import { ToolModes } from '@paplico/editor'
import { useEffect } from 'react'

export type Notifications =
  | {
      type: 'toolChanged'
      tool: ToolModes
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
