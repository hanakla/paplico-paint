import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  StrokeRenderer,
  type BrushSettings,
} from './appearances/stroke-renderer'

// WebGPU関連のモック
const mockDevice = {
  createBuffer: vi.fn(() => ({ destroy: vi.fn() })),
  createShaderModule: vi.fn(),
  createRenderPipeline: vi.fn(),
  createSampler: vi.fn(),
  queue: { writeBuffer: vi.fn() },
} as any

const mockCanvas = {
  getContext: vi.fn(() => ({
    configure: vi.fn(),
  })),
} as any

// navigator.gpu のモック
Object.defineProperty(global.navigator, 'gpu', {
  value: {
    getPreferredCanvasFormat: vi.fn(() => 'bgra8unorm'),
  },
  writable: true,
})

// crypto.randomUUID のモック
Object.defineProperty(global.crypto, 'randomUUID', {
  value: vi.fn(() => 'test-uuid-12345'),
  writable: true,
})

describe('StrokeRenderer ブラシ設定', () => {
  let strokeRenderer: StrokeRenderer

  beforeEach(() => {
    vi.clearAllMocks()
    strokeRenderer = new StrokeRenderer(mockDevice)
  })

  it('デフォルトのブラシ設定が正しく設定される', () => {
    const defaultSettings = strokeRenderer.getBrushSettings()

    expect(defaultSettings.texture).toBe('pencil')
    expect(defaultSettings.scatterRange).toBe(0.5)
    expect(defaultSettings.rotationAdjust).toBe(1)
    expect(defaultSettings.randomRotation).toBe(0)
    expect(defaultSettings.randomScale).toBe(0)
    expect(defaultSettings.inOutInfluence).toBe(1)
    expect(defaultSettings.inOutLength).toBe(100)
    expect(defaultSettings.divisions).toBe(1000)
    expect(defaultSettings.pressureInfluence).toBe(0.8)
    expect(defaultSettings.noiseInfluence).toBe(0)
  })

  it('カスタムブラシ設定が正しく適用される', () => {
    const customSettings: BrushSettings = {
      texture: 'airbrush',
      scatterRange: 1.5,
      rotationAdjust: 0.8,
      randomRotation: 0.3,
      randomScale: 0.2,
      inOutInfluence: 0.7,
      inOutLength: 50,
      divisions: 1500,
      pressureInfluence: 0.9,
      noiseInfluence: 0.1,
    }

    strokeRenderer.setBrushSettings(customSettings)
    const appliedSettings = strokeRenderer.getBrushSettings()

    expect(appliedSettings.texture).toBe('airbrush')
    expect(appliedSettings.scatterRange).toBe(1.5)
    expect(appliedSettings.rotationAdjust).toBe(0.8)
    expect(appliedSettings.randomRotation).toBe(0.3)
    expect(appliedSettings.randomScale).toBe(0.2)
    expect(appliedSettings.inOutInfluence).toBe(0.7)
    expect(appliedSettings.inOutLength).toBe(50)
    expect(appliedSettings.divisions).toBe(1500)
    expect(appliedSettings.pressureInfluence).toBe(0.9)
    expect(appliedSettings.noiseInfluence).toBe(0.1)
  })

  it('部分的なブラシ設定の更新が正しく動作する', () => {
    // 初期設定
    const initialSettings: BrushSettings = {
      texture: 'pencil',
      scatterRange: 0.5,
      rotationAdjust: 1,
      randomRotation: 0,
      randomScale: 0,
      inOutInfluence: 1,
      inOutLength: 100,
      divisions: 1000,
      pressureInfluence: 0.8,
      noiseInfluence: 0,
    }

    strokeRenderer.setBrushSettings(initialSettings)

    // 部分的な更新
    const partialUpdate = {
      texture: 'airbrush' as const,
      scatterRange: 2.0,
      randomRotation: 0.5,
    }

    strokeRenderer.setBrushSettings({ ...initialSettings, ...partialUpdate })
    const updatedSettings = strokeRenderer.getBrushSettings()

    // 更新された値
    expect(updatedSettings.texture).toBe('airbrush')
    expect(updatedSettings.scatterRange).toBe(2.0)
    expect(updatedSettings.randomRotation).toBe(0.5)

    // 変更されていない値
    expect(updatedSettings.rotationAdjust).toBe(1)
    expect(updatedSettings.randomScale).toBe(0)
    expect(updatedSettings.inOutInfluence).toBe(1)
    expect(updatedSettings.inOutLength).toBe(100)
    expect(updatedSettings.divisions).toBe(1000)
    expect(updatedSettings.pressureInfluence).toBe(0.8)
    expect(updatedSettings.noiseInfluence).toBe(0)
  })

  it('複数回の設定変更が正しく動作する', () => {
    // 最初の設定
    strokeRenderer.setBrushSettings({
      texture: 'pencil',
      scatterRange: 1.0,
      rotationAdjust: 1,
      randomRotation: 0,
      randomScale: 0,
      inOutInfluence: 1,
      inOutLength: 100,
      divisions: 1000,
      pressureInfluence: 0.8,
      noiseInfluence: 0,
    })

    // 2回目の設定変更
    strokeRenderer.setBrushSettings({
      texture: 'airbrush',
      scatterRange: 0.3,
      rotationAdjust: 0.7,
      randomRotation: 0.2,
      randomScale: 0.1,
      inOutInfluence: 0.8,
      inOutLength: 80,
      divisions: 1200,
      pressureInfluence: 0.9,
      noiseInfluence: 0.05,
    })

    // 3回目の設定変更
    strokeRenderer.setBrushSettings({
      texture: 'pencil',
      scatterRange: 1.8,
      rotationAdjust: 1.2,
      randomRotation: 0.6,
      randomScale: 0.4,
      inOutInfluence: 0.5,
      inOutLength: 150,
      divisions: 800,
      pressureInfluence: 0.7,
      noiseInfluence: 0.15,
    })

    const finalSettings = strokeRenderer.getBrushSettings()

    expect(finalSettings.texture).toBe('pencil')
    expect(finalSettings.scatterRange).toBe(1.8)
    expect(finalSettings.rotationAdjust).toBe(1.2)
    expect(finalSettings.randomRotation).toBe(0.6)
    expect(finalSettings.randomScale).toBe(0.4)
    expect(finalSettings.inOutInfluence).toBe(0.5)
    expect(finalSettings.inOutLength).toBe(150)
    expect(finalSettings.divisions).toBe(800)
    expect(finalSettings.pressureInfluence).toBe(0.7)
    expect(finalSettings.noiseInfluence).toBe(0.15)
  })

  it('設定の独立性が保たれる（参照の共有がない）', () => {
    const settings1: BrushSettings = {
      texture: 'pencil',
      scatterRange: 1.0,
      rotationAdjust: 1,
      randomRotation: 0,
      randomScale: 0,
      inOutInfluence: 1,
      inOutLength: 100,
      divisions: 1000,
      pressureInfluence: 0.8,
      noiseInfluence: 0,
    }

    strokeRenderer.setBrushSettings(settings1)

    // 元のオブジェクトを変更
    settings1.scatterRange = 999
    settings1.texture = 'airbrush'

    // StrokeRenderer内の設定は変更されていないはず
    const storedSettings = strokeRenderer.getBrushSettings()
    expect(storedSettings.scatterRange).toBe(1.0)
    expect(storedSettings.texture).toBe('pencil')
  })

  it('getBrushSettingsが新しいオブジェクトを返す（参照の独立性）', () => {
    const settings: BrushSettings = {
      texture: 'airbrush',
      scatterRange: 0.7,
      rotationAdjust: 1,
      randomRotation: 0,
      randomScale: 0,
      inOutInfluence: 1,
      inOutLength: 100,
      divisions: 1000,
      pressureInfluence: 0.8,
      noiseInfluence: 0,
    }

    strokeRenderer.setBrushSettings(settings)

    const retrieved1 = strokeRenderer.getBrushSettings()
    const retrieved2 = strokeRenderer.getBrushSettings()

    // 異なるオブジェクトインスタンスであることを確認
    expect(retrieved1).not.toBe(retrieved2)

    // しかし値は同じ
    expect(retrieved1).toEqual(retrieved2)

    // 一方を変更しても他方に影響しない
    retrieved1.scatterRange = 999
    expect(retrieved2.scatterRange).toBe(0.7)
  })
})
