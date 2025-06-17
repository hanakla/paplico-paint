import { describe, it, expect, vi } from 'vitest'
import { createStrokeInstances, type BrushSettings } from './stroke-renderer'
import type { VectorPath, Vector2 } from '../../state'

// パフォーマンステスト用のユーティリティ
function createLargeTestPath(vertexCount: number): VectorPath {
  const points: Vector2[] = []

  // 複雑な曲線パスを生成（円形と波形の組み合わせ）
  for (let i = 0; i < vertexCount; i++) {
    const t = (i / (vertexCount - 1)) * Math.PI * 4 // 2周分
    const radius = 100 + 50 * Math.sin(t * 3) // 半径の変化
    const angle = t + Math.sin(t * 2) * 0.5 // 角度の歪み

    points.push({
      x: Math.cos(angle) * radius + 200 + Math.sin(t * 5) * 20,
      y: Math.sin(angle) * radius + 200 + Math.cos(t * 7) * 15,
    })
  }

  return {
    id: 'test-path',
    points,
    color: { r: 0, g: 0, b: 0, a: 1 },
    strokeWidth: 2,
    closed: false,
  }
}

function createTestBrushSettings(): BrushSettings {
  return {
    texture: 'pencil',
    divisions: 1000,
    scatterRange: 2.0,
    rotationAdjust: 1.0,
    randomRotation: 0.1,
    randomScale: 0.2,
    inOutInfluence: 0.8,
    inOutLength: 50,
    pressureInfluence: 0.8,
    noiseInfluence: 0.1,
  }
}

describe('StrokeRenderer Performance Tests', () => {
  describe('createStrokeInstances', () => {
    it('should handle empty path', () => {
      const emptyPath: VectorPath = {
        points: [],
        color: { r: 0, g: 0, b: 0, a: 1 },
        closed: false,
      }
      const brushSettings = createTestBrushSettings()

      const result = createStrokeInstances(emptyPath, 10, brushSettings)
      expect(result).toEqual([])
    })

    it('should perform well with 2 vertex path', () => {
      const twoVertexPath: VectorPath = {
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        color: { r: 1, g: 0, b: 0, a: 1 },
        closed: false,
      }
      const brushSettings = createTestBrushSettings()

      // パフォーマンス計測
      const startTime = performance.now()
      const result = createStrokeInstances(twoVertexPath, 10, brushSettings)
      const endTime = performance.now()

      const executionTime = endTime - startTime

      // パフォーマンス期待値
      expect(executionTime).toBeLessThan(5) // 5ms以下
      expect(result.length).toBeGreaterThan(0)
    })

    it('should create instances for simple path', () => {
      const simplePath: VectorPath = {
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
        ],
        color: { r: 1, g: 0, b: 0, a: 1 },
        closed: false,
      }
      const brushSettings = createTestBrushSettings()

      const result = createStrokeInstances(simplePath, 10, brushSettings)

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]).toHaveProperty('position')
      expect(result[0]).toHaveProperty('size')
      expect(result[0]).toHaveProperty('rotation')
      expect(result[0]).toHaveProperty('opacity')
      expect(result[0]).toHaveProperty('scale')
    })

    it('should perform well with 1000+ vertex path', () => {
      const largePath = createLargeTestPath(1000)
      const brushSettings = createTestBrushSettings()

      // パフォーマンス計測
      const startTime = performance.now()
      const result = createStrokeInstances(largePath, 5, brushSettings)
      const endTime = performance.now()

      const executionTime = endTime - startTime

      // パフォーマンス期待値
      expect(executionTime).toBeLessThan(100) // 100ms以下
      expect(result.length).toBeGreaterThan(0)
    })

    it('should perform well with 2000+ vertex path', () => {
      const largePath = createLargeTestPath(2000)
      const brushSettings = createTestBrushSettings()

      const startTime = performance.now()
      const result = createStrokeInstances(largePath, 3, brushSettings)
      const endTime = performance.now()

      const executionTime = endTime - startTime

      // より厳しいパフォーマンス要求
      expect(executionTime).toBeLessThan(200) // 200ms以下
      expect(result.length).toBeGreaterThan(0)
    })

    it('should perform well with 5000+ vertex path', () => {
      const largePath = createLargeTestPath(5000)
      const brushSettings = createTestBrushSettings()

      const startTime = performance.now()
      const result = createStrokeInstances(largePath, 2, brushSettings)
      const endTime = performance.now()

      const executionTime = endTime - startTime

      // 非常に大きなパスでのパフォーマンス
      expect(executionTime).toBeLessThan(500) // 500ms以下
      expect(result.length).toBeGreaterThan(0)
    })

    it('should scale performance linearly with vertex count', () => {
      const vertexCounts = [500, 1000, 2000]
      const timings: number[] = []
      const brushSettings = createTestBrushSettings()

      for (const count of vertexCounts) {
        const path = createLargeTestPath(count)

        const startTime = performance.now()
        createStrokeInstances(path, 4, brushSettings)
        const endTime = performance.now()

        timings.push(endTime - startTime)
      }

      // 時間の増加が線形に近いことを確認
      const ratio1 = timings[1] / timings[0] // 1000 / 500
      const ratio2 = timings[2] / timings[1] // 2000 / 1000

      // 計算複雑度がO(n)に近いことを確認（多少の誤差は許容）
      expect(ratio1).toBeLessThan(3) // 2倍を大きく超えない
      expect(ratio2).toBeLessThan(3) // 2倍を大きく超えない
    })

    it('should handle different brush settings efficiently', () => {
      const largePath = createLargeTestPath(1500)

      // 異なるブラシ設定でのパフォーマンステスト
      const testCases = [
        { scatterRange: 0, randomScale: 0, randomRotation: 0 }, // 最小設定
        { scatterRange: 5, randomScale: 0.5, randomRotation: 0.3 }, // 標準設定
        { scatterRange: 10, randomScale: 1.0, randomRotation: 1.0 }, // 最大設定
      ]

      for (const [index, settingsOverride] of testCases.entries()) {
        const brushSettings = {
          ...createTestBrushSettings(),
          ...settingsOverride,
        }

        const startTime = performance.now()
        const result = createStrokeInstances(largePath, 4, brushSettings)
        const endTime = performance.now()

        const executionTime = endTime - startTime

        expect(executionTime).toBeLessThan(150) // 各設定で150ms以下
        expect(result.length).toBeGreaterThan(0)
      }
    })

    it('should produce consistent results for same input', () => {
      const path = createLargeTestPath(1000)
      const brushSettings = createTestBrushSettings()

      // ランダム要素があるため、seed固定をシミュレート
      const originalRandom = Math.random
      let seedValue = 12345
      Math.random = () => {
        seedValue = (seedValue * 9301 + 49297) % 233280
        return seedValue / 233280
      }

      try {
        const result1 = createStrokeInstances(path, 5, brushSettings)

        // seedをリセット
        seedValue = 12345
        const result2 = createStrokeInstances(path, 5, brushSettings)

        expect(result1.length).toBe(result2.length)
        // 同じseedであれば同じ結果が得られることを確認
        expect(result1[0].position.x).toBeCloseTo(result2[0].position.x, 5)
        expect(result1[0].position.y).toBeCloseTo(result2[0].position.y, 5)
      } finally {
        Math.random = originalRandom
      }
    })
  })

  describe('Memory usage optimization', () => {
    it('should not leak memory with large paths', () => {
      const largePath = createLargeTestPath(3000)
      const brushSettings = createTestBrushSettings()

      // メモリ使用量の初期値（概算）
      const initialMemory = performance.memory?.usedJSHeapSize || 0

      // 複数回実行してメモリリークをチェック
      for (let i = 0; i < 10; i++) {
        const result = createStrokeInstances(largePath, 3, brushSettings)
        expect(result.length).toBeGreaterThan(0)
      }

      // ガベージコレクションを促す
      if (global.gc) {
        global.gc()
      }

      const finalMemory = performance.memory?.usedJSHeapSize || 0
      const memoryIncrease = finalMemory - initialMemory

      // メモリ増加が許容範囲内であることを確認（5MB以下）
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024)
    })
  })
})
