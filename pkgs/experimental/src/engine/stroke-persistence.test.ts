import { describe, it, expect, beforeEach, vi } from 'vitest'
import { engineState, convertVectorPathToArtObject, setDocument } from './state'
import { createTestDocument } from '../app/(app)/_example'
import { isStrokeAppearance } from './document/appearance'
import type { VectorPath } from './state'

// モックの設定
vi.mock('../utils/debug-logger', () => ({
  debugLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('ストロークの永続化とブラシ設定', () => {
  beforeEach(() => {
    // テスト用ドキュメントを設定
    const testDoc = createTestDocument()
    setDocument(testDoc)

    // ブラシ設定をリセット
    engineState.brushConfig.strokeSettings = {
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
  })

  it('VectorPathが正しく永続化される', () => {
    const vectorPath: VectorPath = {
      id: 'test-path-1',
      points: [
        { x: 100, y: 100 },
        { x: 200, y: 150 },
        { x: 300, y: 100 },
      ],
      color: { r: 1, g: 0, b: 0, a: 1 },
      strokeWidth: 10,
      closed: false,
    }

    const pathArtObject = convertVectorPathToArtObject(vectorPath)

    expect(pathArtObject).toBeTruthy()
    expect(pathArtObject?.type).toBe('path')
    expect(pathArtObject?.appearances).toHaveLength(1)
  })

  it('ブラシ設定が永続化されたStrokeAppearanceに正しく保存される', () => {
    // カスタムブラシ設定を設定
    engineState.brushConfig.strokeSettings = {
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

    const vectorPath: VectorPath = {
      id: 'test-path-2',
      points: [
        { x: 50, y: 50 },
        { x: 150, y: 100 },
      ],
      color: { r: 0, g: 1, b: 0, a: 1 },
      strokeWidth: 15,
      closed: false,
    }

    const pathArtObject = convertVectorPathToArtObject(vectorPath)

    expect(pathArtObject).toBeTruthy()
    expect(pathArtObject?.appearances).toHaveLength(1)

    const strokeAppearance = pathArtObject?.appearances[0]
    expect(isStrokeAppearance(strokeAppearance!)).toBe(true)

    if (isStrokeAppearance(strokeAppearance!)) {
      const brushSettings = strokeAppearance.params.brushSettings
      expect(brushSettings).toBeTruthy()
      expect(brushSettings?.texture).toBe('airbrush')
      expect(brushSettings?.scatterRange).toBe(1.5)
      expect(brushSettings?.rotationAdjust).toBe(0.8)
      expect(brushSettings?.randomRotation).toBe(0.3)
      expect(brushSettings?.randomScale).toBe(0.2)
      expect(brushSettings?.inOutInfluence).toBe(0.7)
      expect(brushSettings?.inOutLength).toBe(50)
      expect(brushSettings?.divisions).toBe(1500)
      expect(brushSettings?.pressureInfluence).toBe(0.9)
      expect(brushSettings?.noiseInfluence).toBe(0.1)
    }
  })

  it('ブラシ設定がnullの場合はundefinedで保存される', () => {
    // ブラシ設定をnullに設定
    engineState.brushConfig.strokeSettings = undefined

    const vectorPath: VectorPath = {
      id: 'test-path-3',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ],
      color: { r: 0, g: 0, b: 1, a: 1 },
      strokeWidth: 5,
      closed: false,
    }

    const pathArtObject = convertVectorPathToArtObject(vectorPath)

    expect(pathArtObject).toBeTruthy()
    expect(pathArtObject?.appearances).toHaveLength(1)

    const strokeAppearance = pathArtObject?.appearances[0]
    if (isStrokeAppearance(strokeAppearance!)) {
      expect(strokeAppearance.params.brushSettings).toBeUndefined()
    }
  })

  it('異なるブラシ設定で複数のストロークが独立して保存される', () => {
    // 最初のストローク
    engineState.brushConfig.strokeSettings = {
      texture: 'pencil',
      scatterRange: 0.3,
      rotationAdjust: 1,
      randomRotation: 0,
      randomScale: 0,
      inOutInfluence: 1,
      inOutLength: 100,
      divisions: 1000,
      pressureInfluence: 0.8,
      noiseInfluence: 0,
    }

    const vectorPath1: VectorPath = {
      id: 'test-path-4a',
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 50 },
      ],
      color: { r: 1, g: 0, b: 0, a: 1 },
      strokeWidth: 5,
      closed: false,
    }

    const pathArtObject1 = convertVectorPathToArtObject(vectorPath1)

    // 設定を変更して2番目のストローク
    engineState.brushConfig.strokeSettings = {
      texture: 'airbrush',
      scatterRange: 2.0,
      rotationAdjust: 0.5,
      randomRotation: 0.8,
      randomScale: 0.5,
      inOutInfluence: 0.3,
      inOutLength: 200,
      divisions: 2000,
      pressureInfluence: 0.6,
      noiseInfluence: 0.2,
    }

    const vectorPath2: VectorPath = {
      id: 'test-path-4b',
      points: [
        { x: 100, y: 100 },
        { x: 150, y: 150 },
      ],
      color: { r: 0, g: 1, b: 0, a: 1 },
      strokeWidth: 10,
      closed: false,
    }

    const pathArtObject2 = convertVectorPathToArtObject(vectorPath2)

    // 両方のストロークがそれぞれ独立した設定を持っているか確認
    expect(pathArtObject1).toBeTruthy()
    expect(pathArtObject2).toBeTruthy()

    const stroke1 = pathArtObject1?.appearances[0]
    const stroke2 = pathArtObject2?.appearances[0]

    if (isStrokeAppearance(stroke1!) && isStrokeAppearance(stroke2!)) {
      // 1番目のストロークの設定
      expect(stroke1.params.brushSettings?.texture).toBe('pencil')
      expect(stroke1.params.brushSettings?.scatterRange).toBe(0.3)

      // 2番目のストロークの設定
      expect(stroke2.params.brushSettings?.texture).toBe('airbrush')
      expect(stroke2.params.brushSettings?.scatterRange).toBe(2.0)
      expect(stroke2.params.brushSettings?.randomRotation).toBe(0.8)
    }
  })

  it('ストローク基本パラメータが正しく保存される', () => {
    const vectorPath: VectorPath = {
      id: 'test-path-5',
      points: [
        { x: 10, y: 10 },
        { x: 20, y: 20 },
      ],
      color: { r: 0.5, g: 0.7, b: 0.9, a: 0.8 },
      strokeWidth: 25,
      closed: false,
    }

    const pathArtObject = convertVectorPathToArtObject(vectorPath)

    expect(pathArtObject).toBeTruthy()
    expect(pathArtObject?.appearances).toHaveLength(1)

    const strokeAppearance = pathArtObject?.appearances[0]
    if (isStrokeAppearance(strokeAppearance!)) {
      expect(strokeAppearance.params.width).toBe(25)
      expect(strokeAppearance.params.color.r).toBe(0.5)
      expect(strokeAppearance.params.color.g).toBe(0.7)
      expect(strokeAppearance.params.color.b).toBe(0.9)
      expect(strokeAppearance.params.color.a).toBe(0.8)
      expect(strokeAppearance.params.opacity).toBe(1.0)
      expect(strokeAppearance.params.style).toBe('solid')
      expect(strokeAppearance.params.lineCap).toBe('round')
      expect(strokeAppearance.params.lineJoin).toBe('round')
    }
  })

  it('パスの座標が正しく保存される', () => {
    const points = [
      { x: 100.5, y: 200.7 },
      { x: 150.3, y: 250.9 },
      { x: 200.1, y: 300.4 },
    ]

    const vectorPath: VectorPath = {
      id: 'test-path-6',
      points,
      color: { r: 1, g: 1, b: 1, a: 1 },
      strokeWidth: 8,
      closed: false,
    }

    const pathArtObject = convertVectorPathToArtObject(vectorPath)

    expect(pathArtObject).toBeTruthy()
    expect(pathArtObject?.path.points).toHaveLength(3)
    expect(pathArtObject?.path.points[0].x).toBe(100.5)
    expect(pathArtObject?.path.points[0].y).toBe(200.7)
    expect(pathArtObject?.path.points[2].x).toBe(200.1)
    expect(pathArtObject?.path.points[2].y).toBe(300.4)
    expect(pathArtObject?.path.closed).toBe(false)
  })
})
