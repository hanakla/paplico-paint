import { ClientSentPayloads } from '@/shared/client-sent-payloads'
import { ServerSentPayloads } from '@/shared/server-sent-payloads'
import { Document, Paplico, UIStroke } from '@paplico/core-new'
import { IPaplicoChatBackend } from './IPaplicoChatBackend'

const serialize = (payload: ClientSentPayloads) => JSON.stringify(payload)

export class PaplicoChatWebSocketBackend implements IPaplicoChatBackend {
  protected ws: WebSocket | null = null
  protected wsUrl: string

  constructor(options: { wsUrl: string }) {
    this.wsUrl = options.wsUrl
  }

  public dispose() {
    this.ws?.close()
  }

  public async connect(pap: Paplico) {
    this.ws = new WebSocket(this.wsUrl)

    this.ws.addEventListener('message', (e) => {
      const message: ServerSentPayloads = JSON.parse(e.data)

      switch (message.type) {
        case 'joined': {
          const { roomId, layerIds, canvasSize } = message

          const doc = Document.createDocument(canvasSize)
          pap.loadDocument(doc)

          layerIds.forEach((layerId: string, idx: number) => {
            const layer = Document.createRasterLayerEntity({
              width: canvasSize.width,
              height: canvasSize.height,
              name: `Layer ${idx + 1}`,
            })

            layer.uid = layerId
            doc.addLayer(layer)
          })

          pap.loadDocument(doc)
          pap.setStrokingTargetLayer([layerIds[0]])

          console.info(`⚡ Joined room: ${roomId}`)
          break
        }
        case 'strokeComplete': {
          console.log('⚡ receive strokeComplete')
          const {
            uiStroke,
            targetLayerUid,
            brushSetting: strokeSettings,
          } = message

          pap.putStrokeComplete(Object.assign(new UIStroke(), uiStroke), {
            targetLayerUid,
            strokeSettings: strokeSettings,
          })
          break
        }
      }
    })

    return new Promise<void>((resolve, reject) => {
      const onError = (e: Event) => {
        reject(e)
      }

      this.ws!.addEventListener('open', () => {
        this.ws!.removeEventListener('error', onError)
        resolve()
      })

      this.ws!.addEventListener('error', onError)
    })
  }

  public async requestJoin(roomId?: string) {
    this.ws?.send(
      serialize({
        type: 'join',
      }),
    )
  }

  public putStrokeComplete(
    data: Omit<ClientSentPayloads.StrokeCompletePayload, 'type'>,
  ) {
    this.ws?.send(
      serialize({
        type: 'strokeComplete',
        ...data,
      }),
    )
  }
}
