import { shallowEquals } from '🙌/utils/object'

export function it(title: string) {
  const expect = function <T>(expect: T) {
    return {
      toEqual: (actual: T) => {
        const result = shallowEquals(expect, actual)
        if (result) console.info(`✅ Success ${title}`, { expect, actual })
        if (!result) console.error(`🥺　Failed ${title}`, { expect, actual })
      },
    }
  }
  return { expect }
}

export function describe(name: string, fn: () => void) {
  console.group(name)
  try {
    fn()
  } catch (e) {
    console.error(e)
  }
  console.groupEnd()
}
