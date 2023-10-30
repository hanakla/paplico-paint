import { VectorStrokeSetting } from '@paplico/core-new/dist/Document'
import { UIStrokeJSON } from './structs'

export type ServerSentPayloads = RoomJoinedPayload | StrokeCompletePayload

export type RoomJoinedPayload = {
  type: 'joined'
  roomId: string
  layerIds: string[]
  canvasSize: { width: number; height: number }
}

export type StrokeCompletePayload = {
  type: 'strokeComplete'
  uiStroke: UIStrokeJSON
  strokeSettings: VectorStrokeSetting<any> | null
  targetLayerUid: string
}
