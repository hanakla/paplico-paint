const readonly: ProxyHandler<any> = {}

type Draft<T extends object> = {
  [K in keyof T]: T[K] extends object ? Draft<object> : T[K]
}

type ChangeSet = { [key: string]: [Ops, any] }

const Ops = {
  set: 'set',
  add: 'add',
  delete: 'delete',
} as const

type Ops = (typeof Ops)[keyof typeof Ops]

export const produce = <T extends object>(base: T, fn: (draft: T) => void) => {
  const changed = new Map<object, ChangeSet>()
  const revokers = new Set<() => void>()

  const handler: ProxyHandler<T> = {
    get(target, prop, receiver) {
      console.log('get', { target, prop, receiver })

      let returnValue = Reflect.get(target, prop, receiver)

      if (
        (isMap(target) || isSet(target)) &&
        typeof returnValue === 'function'
      ) {
        console.log({ returnValue, receiver })
        return returnValue.bind(target)
      }

      if (
        isObject(returnValue) ||
        Array.isArray(returnValue) ||
        isMap(returnValue) ||
        isSet(returnValue)
      ) {
        if (!changed.has(returnValue)) {
          changed.set(returnValue, {})
        }

        const proxy = Proxy.revocable(returnValue, handler)
        revokers.add(proxy.revoke)
        console.log(proxy.proxy)
        return proxy.proxy
      }

      return returnValue
    },
    set(target, prop, value, receiver) {
      console.log('set', prop, value)

      if (!Object.isExtensible(target) || Object.isFrozen(target)) {
        return false
      }

      if (changed.has(target)) {
        changed.get(target)![prop] = [Ops.set, value]
      } else {
        changed.set(target, { [prop]: value })
      }

      return true
    },
    defineProperty(target, prop, descriptor) {
      console.log('defineProperty')

      if (changed.has(target)) {
        changed.get(target)![prop] = [Ops.set, descriptor]
      }

      return Reflect.defineProperty(target, prop, descriptor)
    },
    deleteProperty(target, prop) {
      console.log('deleteProperty')

      if (changed.has(target)) {
        changed.get(target)![prop] = [Ops.delete, null]
      }

      return Reflect.deleteProperty(target, prop)
    },
    has(target, prop) {
      console.log('has')

      return Reflect.has(target, prop)
    },
    ownKeys(target) {
      console.log('ownKeys')

      return Reflect.ownKeys(target)
    },
    apply(target, thisArg, argArray) {
      console.log('apply')

      return Reflect.apply(target, thisArg, argArray)
    },
    getOwnPropertyDescriptor(target, prop) {
      console.log('getOwnPropertyDescriptor')

      return Reflect.getOwnPropertyDescriptor(target, prop)
    },
    preventExtensions(target) {
      console.log('preventExtensions')

      return Reflect.preventExtensions(target)
    },
    setPrototypeOf(target, v) {
      return Reflect.setPrototypeOf(target, v)
    },
    getPrototypeOf(target) {
      return Reflect.getPrototypeOf(target)
    },
  }

  const proxy = Proxy.revocable(base, handler)
  revokers.add(proxy.revoke)

  fn(proxy.proxy)

  console.log('changed', changed)

  // finish draft
  return base
}

const isObject = (value: any): value is object => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const isMap = (value: any): value is Map<any, any> => {
  return value instanceof Map
}

const isSet = (value: any): value is Set<any> => {
  return value instanceof Set
}

const changeSet = Symbol('changeSet')

class ProxyMap extends Map {
  [changeSet]: {
    original: Map<any, any>
    changes: ChangeSet
  }

  constructor(original: Map<any, any>, changes: ChangeSet) {
    super()
    this[changeSet] = { original, changes }
  }

  get(key: any) {
    return this[changeSet].changes[key] ?? this[changeSet].original.get(key)
  }

  set(key: any, value: any) {
    this[changeSet].changes[key] = [Ops.set, value]
    return this
  }

  delete(key: any) {
    const result =  this[changeSet].changes[key]?.[0] != || this[changeSet].original.has(key)
    this[changeSet].changes[key] = [Ops.delete, null]
    return
  }

  clear() {
    this[changeSet].changes = {}
    return this
  }
}
