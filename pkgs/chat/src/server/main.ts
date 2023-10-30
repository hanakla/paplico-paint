import WebSocket, { WebSocketServer } from 'ws'
import { Rooms } from './rooms'
import { ClientSentPayloads } from '@/shared/client-sent-payloads'
import { ServerSentPayloads } from '@/shared/server-sent-payloads'

export function startPaplicoChatServer({
  port,
  path,
}: {
  port?: number
  path?: string
}) {
  process.on('uncaughtException', (err) => {
    console.error(err)
  })

  const rooms = new Rooms()

  const wss = new WebSocketServer({
    port,
    path,

    perMessageDeflate: {
      zlibDeflateOptions: {
        // See zlib defaults.
        chunkSize: 1024,
        memLevel: 7,
        level: 3,
      },
      zlibInflateOptions: {
        chunkSize: 10 * 1024,
      },
      // Other options settable:
      clientNoContextTakeover: true, // Defaults to negotiated value.
      serverNoContextTakeover: true, // Defaults to negotiated value.
      serverMaxWindowBits: 10, // Defaults to negotiated value.
      // Below options specified as default values.
      concurrencyLimit: 10, // Limits zlib concurrency for perf.
      threshold: 1024, // Size (in bytes) below which messages
      // should not be compressed if context takeover is disabled.
    },
  })

  const clients = new WeakMap<WebSocket, { roomId: string | null }>()

  wss.on('connection', (ws) => {
    console.log('connection')

    clients.set(ws, { roomId: null })

    ws.on('close', () => {
      const { roomId } = clients.get(ws) ?? {}
      if (roomId == null) return

      rooms.removeClient(ws, roomId)
      clients.delete(ws)
    })

    ws.on('message', (message) => {
      let request: ClientSentPayloads = JSON.parse(message.toString('utf-8'))

      switch (request.type) {
        case 'join': {
          let { roomId } = request
          roomId = roomId ?? '__TEST__'

          const room = rooms.addClient(ws, roomId, true)
          clients.set(ws, { roomId })

          ws.send(
            serialize({
              type: 'joined',
              roomId,
              layerIds: room.layerIds,
              canvasSize: room.canvasSize,
            }),
          )

          console.log('client joined', roomId)
          break
        }
        case 'strokeComplete': {
          const { uiStroke, targetLayerUid, strokeSettings } = request
          const { roomId } = clients.get(ws) ?? {}
          if (roomId == null) return

          console.log(`⚡ ${roomId}: receive strokeComplete`)

          const room = rooms.get(roomId)
          if (!room) return

          for (const client of room.clients) {
            if (client === ws) continue
            client.send(
              serialize({
                type: 'strokeComplete',
                uiStroke,
                targetLayerUid,
                strokeSettings,
              }),
            )
          }

          break
        }
      }
    })
  })

  console.log('server started')

  return {
    clients,
    rooms,
  }
}

function serialize(payload: ServerSentPayloads) {
  return JSON.stringify(payload)
}
