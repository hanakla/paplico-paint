import { Document } from '@paplico/core-new'
import { WebSocket } from 'ws'

type RoomData = {
  clients: WebSocket[]
  layerIds: string[]
  canvasSize: { width: number; height: number }
}

export class Rooms {
  public rooms = new Map<string, RoomData>()

  public get(id: string) {
    return this.rooms.get(id)
  }

  public getOrCreate(id: string) {
    const room = this.get(id)
    if (room) return room

    const layerIds = Array(3)
      .fill(null)
      .map(() => {
        return Document.createRasterLayerEntity({
          width: 1,
          height: 1,
          name: 'Layer1',
        }).uid
      })

    const roomClients: WebSocket[] = []
    this.rooms.set(id, {
      layerIds,
      clients: roomClients,
      canvasSize: {
        width: 1000,
        height: 1000,
      },
    })

    return this.rooms.get(id)!
  }

  public addClient(ws: WebSocket, roomId: string, create: true): RoomData
  public addClient(
    ws: WebSocket,
    roomId: string,
    create: boolean,
  ): RoomData | null {
    let room = this.get(roomId)

    if (!room) {
      if (!create) return null

      room = this.getOrCreate(roomId)
    }

    room.clients.push(ws)
    return room
  }

  public removeClient(ws: WebSocket, roomId: string) {
    const room = this.get(roomId)
    if (!room) return

    const index = room.clients.indexOf(ws)
    if (index !== -1) {
      room.clients.splice(index, 1)
    }
  }
}
