import { MouseEvent, SyntheticEvent } from 'react'
import { assign } from './object'

export const DOMUtils = {
  isSameElement: (
    inspect: Element | EventTarget | null,
    target: Element | EventTarget | null
  ) => {
    return inspect === target && inspect !== null
  },
  isChildren: (inspect: Element | EventTarget | null, self: Element | null) => {
    return (self !== inspect && self?.contains(inspect as Element)) ?? false
  },
  childrenOrSelf: (
    inspectTarget: Element | EventTarget | null,
    self: Element | null
  ) => {
    return (
      self === inspectTarget ||
      (self?.contains(inspectTarget as Element) ?? false)
    )
  },
  closestOrSelf: (target: Element | EventTarget | null, selector: string) => {
    const closest = (target as Element).closest(selector)
    return (
      target !== null &&
      ((target as Element).matches(selector) || closest) != null
    )
  },
  getClickedPosisionInElement(e: MouseEvent) {
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      x: e.pageX - rect.left + window.scrollX,
      y: e.pageY - rect.top + window.scrollY,
    }
  },
  domPointToSvgPoint: (svg: SVGSVGElement, point: { x: number; y: number }) => {
    return assign(svg.createSVGPoint(), point).matrixTransform(
      svg.getScreenCTM()!.inverse()
    )
  },
  stopPropagationHandler: (e: SyntheticEvent) => {
    e.stopPropagation()
  },
}
