export type Delta = DeltaNode | DeltaLeaf

export type DeltaResult<T> = T extends Array<infer R>
  ? { [K in keyof T]: DeltaResult<R> }
  : T extends object
  ? { [K in keyof T]?: DeltaResult<T[K]> }
  : DeltaLeaf

export type DeltaNode = {
  [key: string | number]: DeltaLeaf | Delta
}

/** `a` is Added property, `d` is deleted property, `c` is changed property, `cb` is binary change */
export type DeltaLeaf =
  | [type: 'a' | 'd' | 'c', prev: any, next: any]
  | ['cb', binDiff: BinDelta[]]

/** r is replace, e is expand, s is shrink */
type BinDelta =
  | [type: 'r', offset: number, prevData: Uint8Array, nextData: Uint8Array]
  | [type: 'rs', prevByteLength: number, nextByteLength: number]

export function arrayBufferSafeDiff(original: any, modified: any) {
  return diff(original, modified, (prev, next) => {
    if (isTypedArray(prev) || isTypedArray(next)) {
      if (prev === next) return ['notModified']
      return ['c', prev, next]
    }

    return null
  })
}

// Author: ChatGPT, and hand-written
export function diff(
  original: any,
  modified: any,
  replacer?: (prev: any, next: any) => DeltaLeaf | ['notModified'] | null,
): Delta | DeltaLeaf | null {
  if (isPrimitive(original) || isPrimitive(modified)) {
    if (Object.is(original, modified)) {
      return null
    }

    if (original == null || modified == null) {
      return ['c', original, modified]
    }

    if (replacer) {
      const replaced = replacer(original, modified)

      if (replaced) {
        if (replaced?.[0] === 'notModified') return null

        return replaced
      }
    }

    if (Object.getPrototypeOf(original) !== Object.getPrototypeOf(modified)) {
      return ['c', original, modified]
    }

    if (isTypedArray(original) && isTypedArray(modified)) {
      return diffTypedArray(original, modified)
    }

    if (original instanceof Map || modified instanceof Map) {
      throw new Error('jsondiff: Map is not supported')
    }

    if (original instanceof Set || modified instanceof Set) {
      throw new Error('jsondiff: Set is not supported')
    }

    return ['c', original, modified] // 変更されたプロパティ
  }

  if (Array.isArray(original) !== Array.isArray(modified)) {
    return ['c', original, modified]
  }

  if (isObject(original) && isObject(modified)) {
    const changes: Delta = {}

    if (Array.isArray(original) && Array.isArray(modified)) {
      for (
        let i = 0, l = Math.max(original.length, modified.length);
        i < l;
        i++
      ) {
        if (!Object.hasOwn(original, i)) {
          changes[i] = ['a', undefined, modified[i]]
          continue
        }

        const arrayDiff = diff(original[i], modified[i], replacer)

        if (arrayDiff) {
          changes[i] = arrayDiff as DeltaLeaf | Delta
        }
      }

      return changes
    }

    const _o = original as Record<string | number, any>
    const _m = modified as Record<string | number, any>

    for (const key of Object.keys(modified)) {
      const _k = key as any
      const origValue = _o[_k]
      const modValue = _m[_k]

      if (!Object.hasOwn(_o, _k)) {
        changes[_k] = ['a', undefined, _m[_k]]
        continue
      } else {
        const replaced = replacer?.(origValue, modValue) ?? null

        if (replaced) {
          if (replaced?.[0] === 'notModified') continue

          changes[_k] = replaced
          continue
        }

        const result = diff(origValue, modValue, replacer)
        if (result) changes[_k] = result
      }
    }

    for (const key of Object.keys(_o)) {
      const _k = key as any

      if (!Object.hasOwn(_m, key)) {
        changes[_k] = ['d', _o[key as any], undefined]
      }
    }

    return changes
  } else {
    return ['c', original, modified]
  }
}

export const patch = (target: any, delta: Delta | DeltaLeaf | null): any =>
  patchOrUnpatch(target, delta, false)
export const unpatch = (target: any, delta: Delta | DeltaLeaf | null): any =>
  patchOrUnpatch(target, delta, true)

// Author: ChatGPT, and hand-written
export function patchOrUnpatch<T>(
  target: any,
  delta: Delta | DeltaLeaf | null,
  unpatch: boolean,
): any {
  if (!delta) return target
  let _target = target

  if (typeof delta[0] === 'string') {
    if (delta[0] === 'c') {
      return unpatch ? delta[1] : delta[2]
    } else if (delta[0] === 'cb') {
      return patchTypedArray(target, delta[1], unpatch)
    }

    throw new Error('jsondiff: invalid delta')
  }

  for (const key of Object.keys(delta)) {
    const df = delta[key]

    if (typeof df[0] === 'string') {
      if (!unpatch) {
        if (df[0] === 'a') {
          _target[key] = df[2]
        } else if (df[0] === 'd') {
          if (Array.isArray(_target)) {
            _target.splice(Number(key), 1)
          } else {
            delete _target[key]
          }
        } else {
          _target[key] = patchOrUnpatch(_target[key], df, unpatch)
        }
      } else {
        if (df[0] === 'a') {
          if (Array.isArray(_target)) {
            _target.splice(Number(key), 1)
          } else {
            delete _target[key]
          }
        } else if (df[0] === 'd') {
          _target[key] = df[1]
        } else {
          _target[key] = patchOrUnpatch(_target[key], df, unpatch)
        }
      }
    } else {
      _target[key] = patchOrUnpatch(_target[key], df, unpatch)
    }
  }

  return _target
}

// Hand-written
function diffTypedArray(original: TypedArray, modified: TypedArray): DeltaLeaf {
  const patches: BinDelta[] = []

  const originalArray = new Uint8Array(original.buffer, 0, original.byteLength)
  const modifiedArray = new Uint8Array(modified.buffer, 0, modified.byteLength)

  let inChanges = false
  let chunkStart = 0
  for (let i = 0; i < originalArray.byteLength; i++) {
    if (originalArray[i] !== modifiedArray[i]) {
      if (!inChanges) {
        inChanges = true
        chunkStart = i
      } else {
      }
    } else {
      if (inChanges) {
        patches.push([
          'r',
          chunkStart,
          originalArray.slice(chunkStart, i),
          modifiedArray.slice(chunkStart, i),
        ])
        inChanges = false
        chunkStart = 0
      }
    }
  }

  if (inChanges) {
    patches.push([
      'r',
      chunkStart,
      originalArray.slice(chunkStart, originalArray.byteLength),
      modifiedArray.slice(chunkStart, modifiedArray.byteLength),
    ])
  }

  if (originalArray.byteLength !== modifiedArray.byteLength) {
    patches.unshift(['rs', originalArray.byteLength, modifiedArray.byteLength])
  }

  return ['cb', patches]
}

// Hand-written
function patchTypedArray(
  original: TypedArray,
  deltas: BinDelta[],
  unpatch: boolean,
): TypedArray {
  const OriginalTypedArray = original.constructor as TypedArrayConstructor
  let originalArray = new Uint8Array(original.buffer, 0, original.byteLength)

  for (const delta of deltas) {
    if (delta[0] === 'r') {
      const [, offset, prevData, nextData] = delta
      originalArray.set(unpatch ? prevData : nextData, offset)
    } else if (delta[0] === 'rs') {
      const [, prevByteLength, nextByteLength] = delta
      const sizeTo = unpatch ? prevByteLength : nextByteLength

      const newBuffer = new ArrayBuffer(sizeTo)
      const newUint8Array = new Uint8Array(newBuffer)
      newUint8Array.set(originalArray.slice(0, sizeTo), 0)
      originalArray = newUint8Array
    }
  }

  return new OriginalTypedArray(originalArray.buffer)
}

function isPrimitive(obj: any): obj is string | number | boolean | null {
  return (
    typeof obj === 'string' ||
    typeof obj === 'number' ||
    typeof obj === 'boolean' ||
    obj === null ||
    obj === undefined
  )
}

function isObject(obj: any): obj is object {
  return typeof obj === 'object' && obj !== null
}

function isObjectOrArray(obj: any): boolean {
  return isObject(obj) || Array.isArray(obj)
}

type TypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array
  | BigInt64Array
  | BigUint64Array

type TypedArrayConstructor =
  | Int8ArrayConstructor
  | Uint8ArrayConstructor
  | Uint8ClampedArrayConstructor
  | Int16ArrayConstructor
  | Uint16ArrayConstructor
  | Int32ArrayConstructor
  | Uint32ArrayConstructor
  | Float32ArrayConstructor
  | Float64ArrayConstructor
  | BigInt64ArrayConstructor
  | BigUint64ArrayConstructor

const $TypedArray$ = Object.getPrototypeOf(Int8Array)
function isTypedArray(obj: any): obj is TypedArray {
  return obj instanceof $TypedArray$
}
