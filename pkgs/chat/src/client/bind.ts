import { Paplico } from '@paplico/core-new'
import { PaplicoChatWebSocketBackend } from './websocketBackend'

export function paplicoChat(
  pap: Paplico,
  options: {
    backend: PaplicoChatWebSocketBackend
  },
) {
  const { backend } = options

  console.info('⚡ Starting chat mode')

  pap.on('strokePreComplete', (e) => {
    backend.putStrokeComplete({
      uiStroke: e.stroke,
      strokeSettings: pap.getBrushSetting(),
      targetNode: pap.getStrokingTarget()!.nodePath,
    })
  })

  backend.connect(pap).then(() => {})

  const dispose = () => {
    backend.dispose()
  }
  return {
    joinRoom: async (roomId?: string) => {
      await backend.requestJoin(roomId)
    },
    dispose,
  }
}
