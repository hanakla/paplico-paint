import { ClientSentPayloads } from '@/shared/client-sent-payloads'
import { Paplico } from '@paplico/core-new'

export interface IPaplicoChatBackend {
  dispose(): void

  connect(pap: Paplico): Promise<void>

  requestJoin(roomId?: string): Promise<void>

  putStrokeComplete(
    data: Omit<ClientSentPayloads.StrokeCompletePayload, 'type'>,
  ): void
}
