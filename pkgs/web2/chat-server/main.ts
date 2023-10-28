import WebSocket, { WebSocketServer } from 'ws'
import { Document } from '@paplico/core-new'
import { addRoomClient, getOrCreateRoom } from './rooms'

const wss = new WebSocketServer({
  port: 3003,
  path: '/chat-server',

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
    const { roomId: room } = clients.get(ws) ?? {}
    if (room == null) return

    const roomClients = getOrCreateRoom(room)?.clients
    if (!roomClients) return

    const index = roomClients.indexOf(ws)
    if (index !== -1) {
      roomClients.splice(index, 1)
    }

    clients.delete(ws)
  })

  ws.on('message', (message) => {
    let request = JSON.parse(message.toString('utf-8'))

    switch (request.type) {
      case 'join': {
        let { roomId } = request

        if (!roomId) {
          roomId = '__TEST__' // Math.random().toString(36).slice(2)
        }

        const room = addRoomClient(ws, roomId)
        clients.set(ws, { roomId })

        ws.send(
          JSON.stringify({
            type: 'joined',
            roomId,
            layerIds: room.document.layerEntities.map((l) => l.uid),
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

        const room = getOrCreateRoom(roomId, false)
        if (!room) return

        for (const client of room.clients) {
          if (client === ws) continue
          client.send(
            JSON.stringify({
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

process.on('uncaughtException', (err) => {
  console.error(err)
})
