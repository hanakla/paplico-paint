import { nanoid } from 'nanoid'

export function generateUid() {
  return nanoid(30)
}
