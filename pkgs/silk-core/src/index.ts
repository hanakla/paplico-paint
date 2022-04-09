/// <reference path="./declarations.d.ts" />

// export { SilkEngine as Silk } from './engine/Engine'
export { SilkEngine3 as Silk3 } from './engine/Engine3'
export { RenderStrategies } from './engine/RenderStrategy'
export type { IRenderStrategy } from './engine/RenderStrategy'
export { SilkSession } from './Session/Engine3_Sessions'
export { CanvasHandler } from './engine/Engine3_CanvasHandler'
export { SilkDOMDigger } from './SilkDOMDigger'
export * as SilkInks from './Inks/index'

export * as SilkBrushes from './Brushes/index'
export * as SilkCanvasFactory from './Engine3_CanvasFactory'
export * as SilkDOM from './SilkDOM/index'

export * as SilkHelper from './SilkHelpers'
export * as SilkMath from './SilkMath'
export * as SilkValue from './Value/index'
export * as SilkSerializer from './SilkSerializer'
export * as SilkInternals from './engine/internal'
