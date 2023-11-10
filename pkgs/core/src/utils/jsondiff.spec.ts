import { diff, patch, typedArraySafeDiff, unpatch } from './jsondiff'
import { deepClone, deepCloneAndUpdate } from './object'

describe('diff', () => {
  it('test', () => {
    const original = { a: 1, b: true, c: { d: 3, e: 4 } }
    const modified = { a: 1, b: false, c: { d: 3, f: 5 } }

    const delta = diff(original, modified)

    expect(delta).toMatchInlineSnapshot(`
      {
        "b": [
          "c",
          true,
          false,
        ],
        "c": {
          "e": [
            "d",
            4,
            undefined,
          ],
          "f": [
            "a",
            undefined,
            5,
          ],
        },
      }
    `)

    const patched = patch(deepClone(original), delta)
    expect(patched).toEqual(modified)

    const unpatched = unpatch(deepClone(patched), delta)
    expect(unpatched).toEqual(original)
  })

  it('complex data', () => {
    const original = {
      a: 1,
      b: true,
      c: { d: 3, e: 4 },
      f: [1, 2, 3],
      g: {},
      h: [1, 2, 3, 4, [1, 2, { o: 1 }]],
      i: [1, 2, 3, 4, [1, 2, { o: 1 }]],
      j: { a: 1, b: 2 },
      k: { a: [1, 2, 3], b: { c: 'd', e: 'f' } },
    } as any

    const modified = deepCloneAndUpdate(original, (o) => {
      o.a = 2
      o.b = false
      o.c.d = 4
      o.c.f = 5
      o.f.push(4)
      delete o.j
      o.g = null
      o.h = { a: 1 }
      o.i[4][2].o = 111
      delete o.k.a[1]
      delete o.k.b.c
      o.k.b.e = 'g'
      o.k.b.h = 1
    })

    const delta = diff(original, modified)
    expect(patch(deepClone(original), delta)).toEqual(modified)

    const unpatched = unpatch(deepClone(modified), delta)
    expect(unpatched).toEqual(original)
  })

  it('complex array', () => {
    const orig = [1, 3, 0, 8]
    const mod = deepCloneAndUpdate(orig, (o) => {
      o[0] = 2
      delete o[2]
      o[3] = 9
      o.push(10)
    })

    const delta = diff(orig, mod)
    const patched = patch(deepClone(orig), delta)
    expect(patched).toEqual(mod)

    const unpatched = unpatch(deepClone(patched), delta)
    expect(unpatched).toEqual(orig)
  })

  it('replacer', () => {
    const original = { a: new Uint8ClampedArray(10).fill(0) }
    const modified = { a: new Uint8ClampedArray(10).fill(1) }

    const delta = diff(original, modified, (prev, next) => {
      if (
        prev instanceof Uint8ClampedArray &&
        next instanceof Uint8ClampedArray
      ) {
        return ['c', prev, next]
      }

      return null
    })

    expect(delta).toEqual({ a: ['c', original.a, modified.a] })

    const patched = patch(deepClone(original), delta)
    expect(patched).toEqual(modified)

    const unpatched = unpatch(deepClone(patched), delta)
    expect(unpatched).toEqual(original)
  })

  it('TypeArrays', () => {
    const original = {
      u8c: new Uint8ClampedArray(10).fill(0),
      f32: new Float32Array(10).fill(0),
    }
    const modified = {
      a: new Uint8ClampedArray(
        Array.from({ length: 15 }, () => Math.trunc(Math.random() * 255)),
      ),
    }

    const delta = diff(original, modified)

    const patched = patch({ a: new Uint8ClampedArray() }, delta)
    expect(patched).toEqual(modified)

    const unpatched = unpatch(deepClone(patched), delta)
    expect(unpatched).toEqual(original)
  })

  describe.only('breaken cases', () => {
    it('paplico effect diff', () => {
      const original = {
        kind: 'stroke',
        uid: 'filter-01HEVTTEX21NHW83XP8W4EVAJT',
        enabled: true,
        stroke: {
          brushId: '@paplico/core/extras/scatter-brush',
          brushVersion: '0.0.1',
          color: { r: 1, g: 1, b: 0 },
          opacity: 1,
          size: 30,
          settings: {
            texture: 'pencil',
            noiseInfluence: 1,
            inOutInfluence: 0,
            inOutLength: 0,
          },
        },
        ink: {
          inkId: '@paplico/core/ink/TextureRead',
          inkVersion: '0.0.1',
          setting: {},
        },
      }

      const modified = {
        kind: 'stroke',
        uid: 'filter-01HEVTTEX21NHW83XP8W4EVAJT',
        enabled: false,
        stroke: {
          brushId: '@paplico/core/extras/scatter-brush',
          brushVersion: '0.0.1',
          color: { r: 1, g: 1, b: 0 },
          opacity: 1,
          size: 30,
          settings: {
            texture: 'pencil',
            noiseInfluence: 1,
            inOutInfluence: 0,
            inOutLength: 0,
          },
        },
        ink: {
          inkId: '@paplico/core/ink/TextureRead',
          inkVersion: '0.0.1',
          setting: {},
        },
      }

      const delta = typedArraySafeDiff(original, modified)

      expect(delta).toEqual({
        enabled: ['c', true, false],
      })
      expect(delta).not.toHaveProperty('stroke')
      expect(delta).not.toHaveProperty('ink')

      const patched = patch(deepClone(original), delta)
      expect(patched).toEqual(modified)

      const unpatched = unpatch(deepClone(patched), delta)
      expect(unpatched).toEqual(original)
    })
  })
})
