import pal from 'point-at-length'
import { cachedPointAtLength } from './CachedPointAtLength'

describe('CachedPointAtLength', () => {
  const path = `
    M 80 80
    A 45 45, 0, 0, 0, 125 125
    L 125 80 Z
  `

  it('should returns same result tp point-at-length', () => {
    const original = pal(path)
    const cached = cachedPointAtLength(path)

    expect(cached.length()).toEqual(original.length())
    expect(cached.at(0)).toEqual(original.at(0))
    expect(cached.at(1)).toEqual(original.at(1))
    expect(cached.at(100)).toEqual(original.at(100))
    expect(cached.at(1000)).toEqual(original.at(1000))
  })
})

export {}
