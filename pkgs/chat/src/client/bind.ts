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
      strokeSettings: pap.state.currentStroke,
      targetLayerUid: pap.state.activeLayer!.layerUid,
    })
  })

  backend.connect(pap).then(() => {})

  const dispose = () => {
    backend.dispose()
  }
  return {
    joinRoom: (roomId?: string) => {
      backend.requestJoin(roomId)
    },
    dispose,
  }
}
