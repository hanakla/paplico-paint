import { describe, it, expect, vi } from 'vitest'
import { createStrokeInstances, type BrushSettings } from './stroke-renderer'
import type { VectorPath } from '../../document/path'
import type { VectorPoint } from '../../document/types'

// パフォーマンステスト用のユーティリティ
function createLargeTestPath(vertexCount: number): VectorPath {
  const points: VectorPoint[] = []

  // 複雑な曲線パスを生成（円形と波形の組み合わせ）
  for (let i = 0; i < vertexCount; i++) {
    const t = (i / (vertexCount - 1)) * Math.PI * 4 // 2周分
    const radius = 100 + 50 * Math.sin(t * 3) // 半径の変化
    const angle = t + Math.sin(t * 2) * 0.5 // 角度の歪み

    points.push({
      x: Math.cos(angle) * radius + 200 + Math.sin(t * 5) * 20,
      y: Math.sin(angle) * radius + 200 + Math.cos(t * 7) * 15,
      pressure: 0.5 + 0.5 * Math.sin(t * 2),
    })
  }

  return {
    points,
    closed: false,
  }
}

function createTestBrushSettings(): BrushSettings {
  return {
    texture: 'pencil',
    divisions: 1000,
    scatterConfig: {
      spread: 2.0,
      count: 5,
      sizeVariation: 0.2,
      opacityVariation: 0.1,
    },
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
        closed: false,
      }
      const brushSettings = createTestBrushSettings()

      const result = createStrokeInstances(emptyPath, 10, brushSettings)
      expect(result).toEqual([])
    })

    it('should perform well with 2 vertex path', () => {
      const twoVertexPath: VectorPath = {
        points: [
          { x: 0, y: 0, pressure: 1.0 },
          { x: 100, y: 100, pressure: 0.8 },
        ],
        closed: false,
      }
      const brushSettings = createTestBrushSettings()

      // パフォーマンス計測
      const startTime = performance.now()
      const result = createStrokeInstances(twoVertexPath, 10, brushSettings)
      const endTime = performance.now()

      const executionTime = endTime - startTime

      // パフォーマンス期待値
      expect(executionTime).toBeLessThan(10) // 10ms以下
      expect(result.length).toBeGreaterThan(0)
    })

    it('should create instances for simple path', () => {
      const simplePath: VectorPath = {
        points: [
          { x: 0, y: 0, pressure: 1.0 },
          { x: 100, y: 0, pressure: 0.9 },
          { x: 100, y: 100, pressure: 0.8 },
        ],
        closed: false,
      }
      const brushSettings = createTestBrushSettings()

      const result = createStrokeInstances(simplePath, 5, brushSettings)

      expect(result.length).toBeGreaterThan(0)
      result.forEach((instance) => {
        expect(instance.position.x).toBeTypeOf('number')
        expect(instance.position.y).toBeTypeOf('number')
        expect(instance.size).toBeGreaterThan(0)
        expect(instance.opacity).toBeGreaterThan(0)
        expect(instance.opacity).toBeLessThanOrEqual(1)
      })
    })

    it('should handle large paths efficiently', () => {
      const largePath = createLargeTestPath(1000) // 1000頂点の複雑なパス
      const brushSettings = createTestBrushSettings()

      const startTime = performance.now()
      const result = createStrokeInstances(largePath, 2, brushSettings)
      const endTime = performance.now()

      const executionTime = endTime - startTime

      // 大きなパスでも50ms以下で完了すること
      expect(executionTime).toBeLessThan(50)
      expect(result.length).toBeGreaterThan(100)

      // Large path (1000 vertices) processing time: ${executionTime.toFixed(2)}ms
      // Generated instances: ${result.length}
    })

    it('should provide consistent results with same seed', () => {
      const testPath: VectorPath = {
        points: [
          { x: 0, y: 0, pressure: 1.0 },
          { x: 50, y: 50, pressure: 0.8 },
          { x: 100, y: 0, pressure: 0.6 },
        ],
        closed: false,
      }
      const brushSettings = createTestBrushSettings()
      const seed = 12345

      const result1 = createStrokeInstances(testPath, 5, brushSettings, seed)
      const result2 = createStrokeInstances(testPath, 5, brushSettings, seed)

      expect(result1.length).toBe(result2.length)

      // 決定的ランダム性により、同じシードで同じ結果になること
      for (let i = 0; i < result1.length; i++) {
        expect(result1[i].position.x).toBeCloseTo(result2[i].position.x, 6)
        expect(result1[i].position.y).toBeCloseTo(result2[i].position.y, 6)
        expect(result1[i].size).toBeCloseTo(result2[i].size, 6)
        expect(result1[i].rotation).toBeCloseTo(result2[i].rotation, 6)
        expect(result1[i].opacity).toBeCloseTo(result2[i].opacity, 6)
      }
    })
  })
})
