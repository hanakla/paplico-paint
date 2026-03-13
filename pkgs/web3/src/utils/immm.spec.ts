import { produce } from './immm'
import { produce as immer } from 'immer'

describe('immm', () => {
  it('test', () => {
    const source = { a: { c: 'b' }, b: [111], d: new Map() }
    const result = produce(source, (draft) => {
      // console.log({ b: draft.b })
      // draft.b.push(222)
      // draft.b.push(222)

      draft.d.set('a', 'b')
    })

    expect(result).not.toBe(source)
  })

  it('immer', () => {
    const source = { a: { c: 'd' }, b: [111] }
    const result = immer(source, (draft) => {
      draft.b.push(222)
    })

    expect(result).not.toBe(source)
    expect(source.a).toBe(result.a)
    expect(source.b).not.toBe(result.b)
  })
})
