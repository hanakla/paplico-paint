import Pusher, { Options, Channel } from 'pusher-js'
import { ClientSentPayloads } from '@/shared/client-sent-payloads'
import { ServerSentPayloads } from '@/shared/server-sent-payloads'
import { Document, Paplico, UIStroke } from '@paplico/core-new'
import { IPaplicoChatBackend } from './IPaplicoChatBackend'

const serialize = (payload: ClientSentPayloads) => JSON.stringify(payload)

export class PaplicoChatPusherBackend implements IPaplicoChatBackend {
  protected pplc: Paplico | null = null
  protected psr: Pusher | null = null
  protected channel: Channel | null = null

  protected appKey: string
  protected pusherOptions: Options

  constructor(appKey: string, options: Options) {
    this.appKey = appKey
    this.pusherOptions = options
  }

  public dispose() {
    this.channel?.disconnect()
    this.psr?.disconnect()
  }

  public async connect(pplc: Paplico) {
    this.pplc = pplc
    this.psr = await new Promise<Pusher>((resolve, reject) => {
      const psr = new Pusher(this.appKey, this.pusherOptions)
      resolve(psr)
    })
  }

  public async requestJoin(roomId?: string) {
    const channel = (this.channel = this.psr!.subscribe(`private-${roomId}`))

    this.channel = await new Promise<Channel>((resolve, reject) => {
      channel.bind('pusher:subscription_succeeded', () => {
        resolve(channel)
      })

      channel.bind('pusher:subscription_error', (e) => {
        reject(e)
      })
    })

    this.channel.bind('pplc-event', (data: string) => {
      const message: ServerSentPayloads = JSON.parse(data)

      switch (message.type) {
        case 'joined': {
          const { roomId, layerIds, canvasSize } = message

          const doc = Document.visu.createDocument(canvasSize)

          layerIds.forEach((layerId: string, idx: number) => {
            const layer = Document.visu.createCanvasVisually({
              width: canvasSize.width,
              height: canvasSize.height,
              name: `Layer ${idx + 1}`,
            })

            layer.uid = layerId
            doc.layerNodes.addLayerNode(layer)
          })

          this.pplc!.loadDocument(doc)
          this.pplc!.setStrokingTarget([layerIds[0]])

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

          this.pplc!.putStrokeComplete(
            Object.assign(new UIStroke(), uiStroke),
            {
              pathToTargetVisu: [targetLayerUid],
              brushSetting: strokeSettings,
            },
          )
          break
        }
      }
    })

    return new Promise<void>((resolve, reject) => {
      const onError = (e: Event) => {
        reject(e)
      }

      //   this.psr!.addEventListener('open', () => {
      //     this.psr!.removeEventListener('error', onError)
      //     resolve()
      //   })

      //   this.psr!.addEventListener('error', onError)
      // })

      // this.psr?.send(
      //   serialize({
      //     type: 'join',
      //   }),
      // )
    })
  }

  public putStrokeComplete(
    data: Omit<ClientSentPayloads.StrokeCompletePayload, 'type'>,
  ) {
    this.psr?.send(
      serialize({
        type: 'strokeComplete',
        ...data,
      }),
    )
  }
}
