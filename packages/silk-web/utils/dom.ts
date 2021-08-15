export const DOMUtils = {
  childrenOrSelf: (
    inspectTarget: Element | EventTarget | null,
    self: Element | null
  ) => {
    return (
      self === inspectTarget ||
      (self?.contains(inspectTarget as Element) ?? false)
    )
  },
}
