import { Document } from './SilkDOM'
import msgpack from 'msgpack5'

const packer = msgpack()

packer.register(
  1,
  Uint8ClampedArray,
  (obj: Uint8ClampedArray) => Buffer.from(obj.buffer),
  (buffer) => {
    return new Uint8ClampedArray(buffer)
  }
)

type SerializedSchema = {
  schemaVersion: number
  document: any
  extra: Record<string, any>
}

export const exportDocument = (document: Document): Uint8Array => {
  const data: SerializedSchema = {
    schemaVersion: 1,
    document: document.serialize(),
    extra: {},
  }

  return packer.encode(data) as unknown as Uint8Array
}

export const importDocument = (buffer: Uint8Array) => {
  const data: SerializedSchema = packer.decode(buffer as any)

  if (data.schemaVersion === 1) {
    return Document.deserialize(data.document)
  }

  throw new Error(`Unexpected schema version: ${data.schemaVersion}`)
}
