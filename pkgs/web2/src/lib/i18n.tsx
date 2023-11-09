import { useRouter } from 'next/navigation'
import {
  Fragment,
  ReactNode,
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
} from 'react'

type Localized<T> = {
  en: T
  // ja: any
}

export const tx = <T extends Localized<any>>(t: T): Record<keyof T, T['en']> =>
  t

export type TransFn<T extends Localized<any>> = {
  <K extends keyof T['en']>(key: K): string

  <K extends keyof T['en'], P extends Record<string, string>>(
    key: K,
    params?: P,
  ): string

  <K extends keyof T['en'], P extends Record<string, string | ReactNode>>(
    key: K,
    params?: P,
  ): P extends Record<string, infer R>
    ? R extends ReactNode
      ? ReactNode
      : string
    : string
}

export function useTranslation<T extends Localized<any>>(
  texts: T,
  requestedLocale?: string,
): TransFn<T> {
  const [requestLocale, setRequestLocale] = useState(requestedLocale)
  const locale =
    (['ja', 'en'] as const).find((l) => l === requestLocale) ?? 'en'

  const localed = (texts as any)[locale] as Record<keyof T['en'], string>

  useEffect(() => {
    setRequestLocale(requestedLocale ?? navigator.language)
  }, [])

  return <K extends keyof T['en']>(
    key: K,
    params: Record<string, string | ReactNode> = {},
    { onlyText }: { onlyText?: boolean } = {},
  ): any => {
    const text = localed[key]
    if (!text) return null

    let includesVNode = false
    const children = text
      .split(/((?:\{\{.+?\}\})|(?:<br ?\/>))/g)
      .map((part, i) => {
        if (!onlyText && (part === '<br/>' || part === '<br />')) {
          includesVNode = true
          return <br />
        }

        if (!(part.startsWith('{{') && part.endsWith('}}'))) {
          return part
        }

        const key = part.slice(2, -2)
        const value = params[key]

        if (value == null) return null
        if (typeof value !== 'string') {
          includesVNode = true
          return <>value</>
        }

        return value
      })
      .filter(Boolean)

    let next = includesVNode
      ? createElement(Fragment, {}, ...children)
      : children.join('')

    return next
  }
}
