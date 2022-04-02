export const isEventIgnoringTarget = (target: EventTarget | null) => {
  return (target as HTMLElement)?.dataset?.isPaintCanvas != null
}
