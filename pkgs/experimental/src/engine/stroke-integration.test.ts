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

describe('ストロークの一時描画から永続化までの統合テスト', () => {
  beforeEach(() => {
    // テスト用ドキュメントを設定（空のドキュメント）
    const testDoc = createTestDocument()
    // 既存のアートオブジェクトをクリア
    testDoc.artObjects = {}
    testDoc.layers[Object.keys(testDoc.layers)[0]].artObjectIds = []
    setDocument(testDoc)

    // 初期状態をリセット
    engineState.tools.currentStroke = null
    engineState.tools.isDrawing = false
  })

  it('異なるブラシ設定で描画されたストロークが独立して保存される', () => {
    // シナリオ: ユーザーが2つの異なるブラシ設定でストロークを描画する

    // 1. 最初のブラシ設定（鉛筆、細かいスキャッター）
    engineState.brushConfig.strokeSettings = {
      texture: 'pencil',
      scatterRange: 0.2,
      rotationAdjust: 1,
      randomRotation: 0,
      randomScale: 0,
      inOutInfluence: 1,
      inOutLength: 100,
      divisions: 1000,
      pressureInfluence: 0.8,
      noiseInfluence: 0,
    }
    engineState.brushConfig.size = 5
    engineState.brushConfig.color = { r: 1, g: 0, b: 0, a: 1 }

    const stroke1: VectorPath = {
      id: 'integration-stroke-1',
      points: [
        { x: 10, y: 10 },
        { x: 50, y: 30 },
        { x: 90, y: 10 },
      ],
      color: engineState.brushConfig.color,
      strokeWidth: engineState.brushConfig.size,
      closed: false,
    }

    const persistedStroke1 = convertVectorPathToArtObject(
      stroke1,
      document,
      { r: 1, g: 0, b: 0, a: 1 },
      2,
    )

    // 2. ブラシ設定を変更（エアブラシ、大きなスキャッター）
    engineState.brushConfig.strokeSettings = {
      texture: 'airbrush',
      scatterRange: 1.8,
      rotationAdjust: 0.6,
      randomRotation: 0.4,
      randomScale: 0.3,
      inOutInfluence: 0.7,
      inOutLength: 200,
      divisions: 2000,
      pressureInfluence: 0.9,
      noiseInfluence: 0.1,
    }
    engineState.brushConfig.size = 15
    engineState.brushConfig.color = { r: 0, g: 1, b: 0, a: 1 }

    const stroke2: VectorPath = {
      id: 'integration-stroke-2',
      points: [
        { x: 100, y: 100 },
        { x: 150, y: 120 },
        { x: 200, y: 100 },
      ],
      color: engineState.brushConfig.color,
      strokeWidth: engineState.brushConfig.size,
      closed: false,
    }

    const persistedStroke2 = convertVectorPathToArtObject(stroke2)

    // 検証: 両方のストロークが正しく保存されている
    expect(persistedStroke1).toBeTruthy()
    expect(persistedStroke2).toBeTruthy()

    // 検証: ドキュメントに2つのストロークが追加されている
    expect(engineState.document?.artObjects).toBeTruthy()
    const artObjects = Object.values(engineState.document!.artObjects)
    expect(artObjects).toHaveLength(2)

    // 検証: 各ストロークが独立した設定を持っている
    const stroke1Appearance = persistedStroke1!.appearances[0]
    const stroke2Appearance = persistedStroke2!.appearances[0]

    expect(isStrokeAppearance(stroke1Appearance)).toBe(true)
    expect(isStrokeAppearance(stroke2Appearance)).toBe(true)

    if (
      isStrokeAppearance(stroke1Appearance) &&
      isStrokeAppearance(stroke2Appearance)
    ) {
      // 1番目のストロークの設定
      expect(stroke1Appearance.params.brushSettings?.texture).toBe('pencil')
      expect(stroke1Appearance.params.brushSettings?.scatterRange).toBe(0.2)
      expect(stroke1Appearance.params.width).toBe(5)
      expect(stroke1Appearance.params.color.r).toBe(1)
      expect(stroke1Appearance.params.color.g).toBe(0)

      // 2番目のストロークの設定
      expect(stroke2Appearance.params.brushSettings?.texture).toBe('airbrush')
      expect(stroke2Appearance.params.brushSettings?.scatterRange).toBe(1.8)
      expect(stroke2Appearance.params.brushSettings?.randomRotation).toBe(0.4)
      expect(stroke2Appearance.params.width).toBe(15)
      expect(stroke2Appearance.params.color.r).toBe(0)
      expect(stroke2Appearance.params.color.g).toBe(1)
    }
  })

  it('一時ストロークと永続ストロークのレンダリング設定の一貫性', () => {
    // シナリオ: 一時ストロークの設定が永続化時に正しく保持される

    // 特定のブラシ設定
    const testBrushSettings = {
      texture: 'airbrush' as const,
      scatterRange: 1.2,
      rotationAdjust: 0.8,
      randomRotation: 0.6,
      randomScale: 0.4,
      inOutInfluence: 0.9,
      inOutLength: 150,
      divisions: 1800,
      pressureInfluence: 0.95,
      noiseInfluence: 0.05,
    }

    engineState.brushConfig.strokeSettings = testBrushSettings
    engineState.brushConfig.size = 12
    engineState.brushConfig.color = { r: 0.8, g: 0.2, b: 0.9, a: 1 }

    // 一時ストロークのシミュレーション
    const temporaryStroke: VectorPath = {
      id: 'temp-stroke',
      points: [
        { x: 25, y: 25 },
        { x: 75, y: 50 },
        { x: 125, y: 25 },
      ],
      color: engineState.brushConfig.color,
      strokeWidth: engineState.brushConfig.size,
      closed: false,
    }

    // 永続化
    const persistedStroke = convertVectorPathToArtObject(temporaryStroke)

    expect(persistedStroke).toBeTruthy()
    expect(persistedStroke!.appearances).toHaveLength(1)

    const strokeAppearance = persistedStroke!.appearances[0]
    expect(isStrokeAppearance(strokeAppearance)).toBe(true)

    if (isStrokeAppearance(strokeAppearance)) {
      const savedBrushSettings = strokeAppearance.params.brushSettings

      // 一時ストロークで使用していた設定が永続化時に正確に保存されているか確認
      expect(savedBrushSettings).toEqual(testBrushSettings)

      // 基本的なストロークパラメータも確認
      expect(strokeAppearance.params.width).toBe(12)
      expect(strokeAppearance.params.color).toEqual({
        r: 0.8,
        g: 0.2,
        b: 0.9,
        a: 1,
      })
    }
  })

  it('UIの設定変更が新しいストロークにのみ影響する', () => {
    // シナリオ: 既存のストロークがあるときにブラシ設定を変更して新しいストロークを描画

    // 1. 最初のストロークを描画
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

    const firstStroke: VectorPath = {
      id: 'first-stroke',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ],
      color: { r: 1, g: 0, b: 0, a: 1 },
      strokeWidth: 8,
      closed: false,
    }

    const persistedFirstStroke = convertVectorPathToArtObject(firstStroke)

    // 2. ブラシ設定を大幅に変更
    engineState.brushConfig.strokeSettings = {
      texture: 'airbrush',
      scatterRange: 2.5,
      rotationAdjust: 0.3,
      randomRotation: 0.9,
      randomScale: 0.7,
      inOutInfluence: 0.2,
      inOutLength: 300,
      divisions: 3000,
      pressureInfluence: 0.4,
      noiseInfluence: 0.8,
    }

    // 3. 2番目のストロークを描画
    const secondStroke: VectorPath = {
      id: 'second-stroke',
      points: [
        { x: 200, y: 200 },
        { x: 300, y: 300 },
      ],
      color: { r: 0, g: 0, b: 1, a: 1 },
      strokeWidth: 20,
      closed: false,
    }

    const persistedSecondStroke = convertVectorPathToArtObject(secondStroke)

    // 検証: 両方のストロークが存在する
    expect(persistedFirstStroke).toBeTruthy()
    expect(persistedSecondStroke).toBeTruthy()

    const firstAppearance = persistedFirstStroke!.appearances[0]
    const secondAppearance = persistedSecondStroke!.appearances[0]

    expect(isStrokeAppearance(firstAppearance)).toBe(true)
    expect(isStrokeAppearance(secondAppearance)).toBe(true)

    if (
      isStrokeAppearance(firstAppearance) &&
      isStrokeAppearance(secondAppearance)
    ) {
      // 最初のストロークは古い設定を保持
      expect(firstAppearance.params.brushSettings?.texture).toBe('pencil')
      expect(firstAppearance.params.brushSettings?.scatterRange).toBe(0.5)
      expect(firstAppearance.params.brushSettings?.randomRotation).toBe(0)

      // 2番目のストロークは新しい設定を使用
      expect(secondAppearance.params.brushSettings?.texture).toBe('airbrush')
      expect(secondAppearance.params.brushSettings?.scatterRange).toBe(2.5)
      expect(secondAppearance.params.brushSettings?.randomRotation).toBe(0.9)
    }
  })

  it('ブラシ設定なしでのストローク永続化', () => {
    // シナリオ: strokeSettingsがundefinedの場合

    engineState.brushConfig.strokeSettings = undefined
    engineState.brushConfig.size = 10
    engineState.brushConfig.color = { r: 0.5, g: 0.5, b: 0.5, a: 1 }

    const strokeWithoutSettings: VectorPath = {
      id: 'stroke-no-settings',
      points: [
        { x: 50, y: 50 },
        { x: 150, y: 100 },
      ],
      color: engineState.brushConfig.color,
      strokeWidth: engineState.brushConfig.size,
      closed: false,
    }

    const persistedStroke = convertVectorPathToArtObject(strokeWithoutSettings)

    expect(persistedStroke).toBeTruthy()
    expect(persistedStroke!.appearances).toHaveLength(1)

    const strokeAppearance = persistedStroke!.appearances[0]
    if (isStrokeAppearance(strokeAppearance)) {
      expect(strokeAppearance.params.brushSettings).toBeUndefined()

      // 基本パラメータは正しく設定されている
      expect(strokeAppearance.params.width).toBe(10)
      expect(strokeAppearance.params.color).toEqual({
        r: 0.5,
        g: 0.5,
        b: 0.5,
        a: 1,
      })
    }
  })
})
