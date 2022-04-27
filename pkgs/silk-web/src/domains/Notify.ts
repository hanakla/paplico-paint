import { minOps, selector } from '@fleur/fleur'
import { useFleurContext, useStore } from '@fleur/react'
import { nanoid } from 'nanoid'
import { useEffect } from 'react'

export type Notify =
  | {
      area: 'save'
      message: string
      timeout: number
    }
  | {
      area: 'loadingLock'
      timeout: 0
      lock: boolean
      messageKey: string
    }

type State = {
  entries: (Notify & { id: string })[]
}

export const [NotifyStore, NotifyOps] = minOps('Notify', {
  initialState: (): State => ({
    entries: [],
  }),
  ops: {
    create(x, notify: Notify) {
      x.commit((d) => d.entries.push({ id: nanoid(), ...notify }))
    },
    delete(x, id: string) {
      x.commit((d) => {
        d.entries = d.entries.filter((n) => n.id !== id)
      })
    },
  },
})

export const SelectNotify = {
  byArea: selector((get, area: Notify['area']) =>
    get(NotifyStore).entries.filter((n) => n.area === area)
  ),
}

export const useNotifyConsumer = (area: Notify['area'], length: number = 1) => {
  const { executeOperation } = useFleurContext()
  const entries = useStore((get) =>
    SelectNotify.byArea(get, area).slice(-length)
  )

  useEffect(() => {
    entries.forEach((n) => {
      window.setTimeout(() => {
        executeOperation(NotifyOps.delete, n.id)
      }, n.timeout)
    })
  }, [entries.length])

  return entries
}
