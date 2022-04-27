import { minOps, operations } from '@fleur/fleur'

export const [ClipboardStore, ClipboardOps] = minOps('Clipboard', {
  initialState: () => ({}),
  ops: {
    writeObject(x) {
      navigator.clipboard.write([
        new ClipboardItem({
          ['text/plain']: JSON.stringify(),
        }),
      ])
    },
  },
})

export const ClipBoardSelector = {}
