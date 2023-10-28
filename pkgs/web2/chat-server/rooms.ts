import { Document } from '@paplico/core-new'
import { WebSocket } from 'ws'

const rooms = new Map<
  string,
  { document: Document.PaplicoDocument; clients: WebSocket[] }
>()

export function getOrCreateRoom(id: string, create = true) {
  const room = rooms.get(id)
  if (room || !create) return room

  const doc = Document.createDocument({ width: 1000, height: 1000 })
  doc.addLayer(
    Document.createRasterLayerEntity({
      width: 1,
      height: 1,
      name: 'Layer1',
    }),
  )
  doc.addLayer(
    Document.createRasterLayerEntity({
      width: 1,
      height: 1,
      name: 'Layer2',
    }),
  )
  doc.addLayer(
    Document.createRasterLayerEntity({
      width: 1,
      height: 1,
      name: 'Layer3',
    }),
  )

  const roomClients: WebSocket[] = []
  rooms.set(id, { document: doc, clients: roomClients })

  return rooms.get(id)!
}

export function addRoomClient(ws: WebSocket, roomId: string) {
  const room = getOrCreateRoom(roomId)!
  room.clients.push(ws)
  return room
}

export function removeRoomClient(ws: WebSocket, roomId: string) {
  const room = getOrCreateRoom(roomId, false)
  if (!room) return

  const index = room.clients.indexOf(ws)
  if (index !== -1) {
    room.clients.splice(index, 1)
  }
}
