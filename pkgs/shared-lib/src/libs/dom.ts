type HandlerTypeMap<T> = T extends Window
  ? WindowEventMap
  : T extends HTMLElement
  ? HTMLElementEventMap
  : T extends Document
  ? DocumentEventMap
  : T extends EventTarget
  ? { [type: string]: Event }
  : never

export function domOn<T extends EventTarget, K extends keyof HandlerTypeMap<T>>(
  element: T,
  type: K,
  listener: (event: HandlerTypeMap<T>[K]) => void,
  options?: boolean | AddEventListenerOptions,
): () => void {
  const off = () => {
    element.removeEventListener(type as any, listener as any, options)
  }

  element.addEventListener(type as any, listener as any, options)
  return off
}
