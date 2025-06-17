import { describe, it, expect } from 'vitest'
import { triangulatePolygon } from './fill-renderer'
import type { VectorPath } from '../../document/path'
import { createSolidFill } from '../../document/appearance'

describe('triangulatePolygon', () => {
  const createTestAppearance = (
    color = { r: 1, g: 0, b: 0, a: 1 },
    opacity = 1,
  ) => createSolidFill({ color, opacity })

  describe('基本的な三角分割', () => {
    it('3点の三角形は1つの三角形を生成', async () => {
      const path: VectorPath = {
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 50, y: 100 },
        ],
        closed: true,
      }

      const result = await triangulatePolygon(path, createTestAppearance())

      expect(result.length).toBe(18) // 3頂点 × 6要素(x,y,r,g,b,a)
      expect(result.length / 6).toBe(3) // 3頂点
      expect(result.length / 18).toBe(1) // 1つの三角形 })
    })

    it('4点の矩形は2つの三角形を生成', async () => {
      const path: VectorPath = {
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
        ],
        closed: true,
      }

      const result = await triangulatePolygon(path, createTestAppearance())

      expect(result.length).toBe(36) // 6頂点 × 6要素
      expect(result.length / 6).toBe(6) // 6頂点
      expect(result.length / 18).toBe(2) // 2つの三角形
    })

    it('5点のポリゴンは3つの三角形を生成', async () => {
      const path: VectorPath = {
        points: [
          { x: 50, y: 0 },
          { x: 100, y: 50 },
          { x: 75, y: 100 },
          { x: 25, y: 100 },
          { x: 0, y: 50 },
        ],
        closed: true,
      }

      const result = await triangulatePolygon(path, createTestAppearance())

      expect(result.length).toBe(54) // 9頂点 × 6要素
      expect(result.length / 6).toBe(9) // 9頂点
      expect(result.length / 18).toBe(3) // 3つの三角形
    })
  })

  describe('重複点の処理', () => {
    it('閉じたポリゴンの重複する最後の点を除去', async () => {
      const path: VectorPath = {
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
          { x: 0, y: 0 }, // 重複する最後の点
        ],
        closed: true,
      }

      const result = await triangulatePolygon(path, createTestAppearance())

      // 実質4点なので2つの三角形
      expect(result.length).toBe(36) // 6頂点 × 6要素
      expect(result.length / 6).toBe(6) // 6頂点
      expect(result.length / 18).toBe(2) // 2つの三角形
    })

    it('重複しない場合は全ての点を使用', async () => {
      const path: VectorPath = {
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
          { x: 50, y: 50 }, // 重複しない最後の点
        ],
        closed: true,
      }

      const result = await triangulatePolygon(path, createTestAppearance())

      // 5点なので3つの三角形
      expect(result.length).toBe(54) // 9頂点 × 6要素
      expect(result.length / 6).toBe(9) // 9頂点
      expect(result.length / 18).toBe(3) // 3つの三角形
    })
  })

  describe('エラーケース', () => {
    it('2点以下の場合は空の配列を返す', async () => {
      const path: VectorPath = {
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        closed: true,
      }

      const result = await triangulatePolygon(path, createTestAppearance())
      expect(result.length).toBe(0)
    })

    it('点がない場合は空の配列を返す', async () => {
      const path: VectorPath = {
        points: [],
        closed: true,
      }

      const result = await triangulatePolygon(path, createTestAppearance())
      expect(result.length).toBe(0)
    })
  })

  describe('色の適用', () => {
    it('appearanceの色を正しく適用', async () => {
      const path: VectorPath = {
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 50, y: 100 },
        ],
        closed: true,
      }

      const appearance = createTestAppearance(
        { r: 0.2, g: 0.8, b: 0.2, a: 1 },
        0.5,
      )
      const result = await triangulatePolygon(path, appearance)

      // 各頂点の色成分をチェック
      for (let i = 2; i < result.length; i += 6) {
        expect(result[i]).toBeCloseTo(0.2) // r
        expect(result[i + 1]).toBeCloseTo(0.8) // g
        expect(result[i + 2]).toBeCloseTo(0.2) // b
        expect(result[i + 3]).toBeCloseTo(0.5) // a (opacity適用)
      }
    })

    it('不透明度を正しく適用', async () => {
      const path: VectorPath = {
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 50, y: 100 },
        ],
        closed: true,
      }

      const appearance = createTestAppearance({ r: 1, g: 0, b: 0, a: 0.8 }, 0.5)
      const result = await triangulatePolygon(path, appearance)

      // アルファ値 = 0.8 * 0.5 = 0.4
      for (let i = 5; i < result.length; i += 6) {
        expect(result[i]).toBeCloseTo(0.4)
      }
    })
  })

  describe('座標の正確性', () => {
    it('三角形ファンの頂点順序が正しい', async () => {
      const path: VectorPath = {
        points: [
          { x: 0, y: 0 }, // center
          { x: 100, y: 0 }, // p1
          { x: 100, y: 100 }, // p2
          { x: 0, y: 100 }, // p3
        ],
        closed: true,
      }

      const result = await triangulatePolygon(path, createTestAppearance())

      // 最初の三角形: center(0,0) - p1(100,0) - p2(100,100)
      expect(result[0]).toBe(0) // center.x
      expect(result[1]).toBe(0) // center.y
      expect(result[6]).toBe(100) // p1.x
      expect(result[7]).toBe(0) // p1.y
      expect(result[12]).toBe(100) // p2.x
      expect(result[13]).toBe(100) // p2.y

      // 2番目の三角形: center(0,0) - p2(100,100) - p3(0,100)
      expect(result[18]).toBe(0) // center.x
      expect(result[19]).toBe(0) // center.y
      expect(result[24]).toBe(100) // p2.x
      expect(result[25]).toBe(100) // p2.y
      expect(result[30]).toBe(0) // p3.x
      expect(result[31]).toBe(100) // p3.y
    })
  })
})
