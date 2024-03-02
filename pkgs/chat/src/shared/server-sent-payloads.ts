import { Document } from '@paplico/core-new'
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
  brushSetting: Document.VisuFilter.StrokeFilter<any> | null
  targetLayerUid: string
}
