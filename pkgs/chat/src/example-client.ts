import { type Paplico } from '@paplico/core-new'
import { paplicoChat } from './client/bind'
import { PaplicoChatWebSocketBackend } from './client/websocketBackend'

declare const pap: Paplico

paplicoChat(pap, {
  backend: new PaplicoChatWebSocketBackend({
    wsUrl: 'ws://localhost:41234/pap-chat',
  }),
})
