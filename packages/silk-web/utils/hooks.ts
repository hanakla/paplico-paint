import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPopper, Instance, Options, VirtualElement } from '@popperjs/core'
import { useMemo } from 'react'
import { usePopper } from 'react-popper'
import { useToggle } from 'react-use'

export const useMedia = (query: string, defaultState?: boolean) => {
  if (defaultState === undefined) {
    defaultState = false
  }

  const [state, setState] = useState(defaultState)

  useEffect(() => {
    let mounted = true
    const mql = window.matchMedia(query)

    const onChange = function () {
      if (!mounted) return
      setState(!!mql.matches)
    }

    setTimeout(() => {
      setState(mql.matches)
    })

    mql.addEventListener('change', onChange)

    return () => {
      mounted = false
      mql.removeEventListener('change', onChange)
    }
  }, [query])
  return state
}

export const useFloatMenu = () => {
  const reference = useRef<Element | VirtualElement | null>(null)
  const popperRef = useRef<HTMLElement | null>(null)
  const [opened, toggle] = useToggle(false)

  const popper = usePopper(reference, popperRef)
  const style = useMemo(
    () =>
      opened
        ? { visibility: 'visible', pointerEvents: 'all' }
        : { visibility: 'hidden', pointerEvents: 'node' },
    [opened]
  )

  return [reference, popperRef, popper, style, toggle]
}

// export const usePopper = (
//   root: HTMLElement | null,
//   popperElement: HTMLElement | null,
//   options?: Partial<Options> = {}
// ) => {
//   const optionsWithDefaults: Options = useMemo(
//     () => ({
//       onFirstUpdate: options.onFirstUpdate ?? undefined,
//       placement: options.placement ?? 'bottom',
//       strategy: options.strategy ?? 'absolute',
//       modifiers: options.modifiers ?? [],
//     }),
//     [
//       options.onFirstUpdate,
//       options.placement,
//       options.strategy,
//       options.modifiers,
//     ]
//   )

//   const popperRef = useRef<Instance | null>(null)
//   const [state, setState] = useState({
//     styles: {
//       popper: {
//         position: optionsWithDefaults.strategy,
//         left: '0',
//         top: '0',
//       },
//       arrow: {
//         position: 'absolute',
//       },
//     },
//     attributes: {
//       popper: {},
//       arrow: {},
//     },
//   })

//   useIsomorphicLayoutEffect(() => {
//     if (!root || !popperElement) return

//     const _options: Options = {
//       ...optionsWithDefaults,
//       modifiers: (optionsWithDefaults.modifiers ?? []).concat([
//         {
//           name: 'updateState',
//           enabled: true,
//           phase: 'write',
//           fn: ({ state }) => {
//             const elements = Object.keys(state.elements)

//             setState({
//               styles: Object.fromEntries(
//                 elements.map((element) => [
//                   element,
//                   state.styles[element] ?? {},
//                 ])
//               ),
//               attributes: Object.fromEntries(
//                 elements.map((element) => [element, state.attributes[element]])
//               ),
//             } as any)
//           },
//         },
//       ]),
//     }

//     const popper = (popperRef.current = createPopper(
//       root,
//       popperElement,
//       _options
//     ))

//     const intervalId = setInterval(() => {
//       popper.forceUpdate()
//     }, 100)

//     return () => {
//       clearInterval(intervalId)
//       popper.destroy()
//       popperRef.current = null
//     }
//   }, [root, popperElement, options.placement])

//   useIsomorphicLayoutEffect(() => {
//     if (popperRef.current == null) return
//     popperRef.current.setOptions(optionsWithDefaults)
//   }, [optionsWithDefaults])

//   return {
//     styles: state.styles,
//     attributes: state.attributes,
//     update: popperRef.current?.update ?? null,
//     forceUpdate: popperRef.current?.forceUpdate ?? null,
//   }
// }

export const useIsomorphicLayoutEffect = process.browser
  ? useLayoutEffect
  : useEffect
