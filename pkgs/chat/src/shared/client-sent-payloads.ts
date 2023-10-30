import { UIStrokeJSON } from './structs'
import { VectorStrokeSetting } from '@paplico/core-new/dist/Document'

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
    strokeSettings: VectorStrokeSetting<any> | null
    targetLayerUid: string
  }
}
