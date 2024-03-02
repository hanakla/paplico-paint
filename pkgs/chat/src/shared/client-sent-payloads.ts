import { Document } from '@paplico/core-new'
import { UIStrokeJSON } from './structs'

export type ClientSentPayloads =
  | ClientSentPayloads.JoinRoomRequestPayload
  | ClientSentPayloads.StrokeCompletePayload

export namespace ClientSentPayloads {
  export type JoinRoomRequestPayload = {
    type: 'join'
    roomId?: string
  }

  export type StrokeCompletePayload = {
    type: 'strokeComplete'
    uiStroke: UIStrokeJSON
    strokeSettings: Document.VisuFilter.Structs.BrushSetting | null
    targetNode: string[]
  }
}
