import '@testing-library/jest-dom'
import { create, globals } from 'webgpu'

Object.assign(globalThis, globals)
Object.assign(globalThis.navigator, { gpu: create([]) })

// DOM polyfills for radix-ui components
Object.defineProperty(global, 'ResizeObserver', {
  writable: true,
  value: class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
})

Object.defineProperty(global, 'DOMRect', {
  writable: true,
  value: class DOMRect {
    constructor(
      public x = 0,
      public y = 0,
      public width = 0,
      public height = 0,
    ) {}
    static fromRect(other?: DOMRectInit): DOMRect {
      return new DOMRect(other?.x, other?.y, other?.width, other?.height)
    }
    toJSON() {
      return JSON.stringify(this)
    }
  },
})

Object.defineProperty(window, 'HTMLElement', {
  writable: true,
  value: class HTMLElement extends EventTarget {
    style: any = {}
  },
})

// Mock getBoundingClientRect
Element.prototype.getBoundingClientRect = vi.fn(() => ({
  bottom: 0,
  height: 0,
  left: 0,
  right: 0,
  top: 0,
  width: 0,
  x: 0,
  y: 0,
  toJSON: () => {},
}))

// Mock scrollTo
Element.prototype.scrollTo = vi.fn()

// Mock PointerEvent
global.PointerEvent = class PointerEvent extends Event {
  pointerId = 0
  width = 0
  height = 0
  pressure = 0
  tangentialPressure = 0
  tiltX = 0
  tiltY = 0
  twist = 0
  pointerType = 'mouse'
  isPrimary = false

  constructor(type: string, options: any = {}) {
    super(type, options)
    this.pointerId = options.pointerId ?? 0
    this.width = options.width ?? 0
    this.height = options.height ?? 0
    this.pressure = options.pressure ?? 0
    this.tangentialPressure = options.tangentialPressure ?? 0
    this.tiltX = options.tiltX ?? 0
    this.tiltY = options.tiltY ?? 0
    this.twist = options.twist ?? 0
    this.pointerType = options.pointerType ?? 'mouse'
    this.isPrimary = options.isPrimary ?? false
  }
} as any
