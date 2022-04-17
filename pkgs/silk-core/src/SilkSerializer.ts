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

export const exportDocument = <E extends Record<string, any>>(
  document: Document,
  extra: E = {} as E
): Uint8Array => {
  const data: SerializedSchema = {
    schemaVersion: 1,
    document: document.serialize(),
    extra: extra,
  }

  return packer.encode(data) as unknown as Uint8Array
}

export const importDocument = (buffer: Uint8Array) => {
  const data: SerializedSchema = packer.decode(buffer as any)

  if (data.schemaVersion === 1) {
    return {
      schemaVersion: data.schemaVersion,
      document: Document.deserialize(data.document),
      extra: data.extra ?? {},
    }
  }

  throw new Error(`Unexpected schema version: ${data.schemaVersion}`)
}
