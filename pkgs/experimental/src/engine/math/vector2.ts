/**
 * 2D ベクトル型
 */
export interface Vector2 {
  x: number
  y: number
}

/**
 * Vector2 ユーティリティ関数
 */
export class Vector2 {
  /**
   * ベクトルを作成
   */
  static create(x: number, y: number): Vector2 {
    return { x, y }
  }

  /**
   * ゼロベクトルを作成
   */
  static zero(): Vector2 {
    return { x: 0, y: 0 }
  }

  /**
   * ベクトルを加算
   */
  static add(a: Vector2, b: Vector2): Vector2 {
    return { x: a.x + b.x, y: a.y + b.y }
  }

  /**
   * ベクトルを減算
   */
  static subtract(a: Vector2, b: Vector2): Vector2 {
    return { x: a.x - b.x, y: a.y - b.y }
  }

  /**
   * ベクトルをスカラー倍
   */
  static multiply(v: Vector2, scalar: number): Vector2 {
    return { x: v.x * scalar, y: v.y * scalar }
  }

  /**
   * ベクトルをスカラー除算
   */
  static divide(v: Vector2, scalar: number): Vector2 {
    return { x: v.x / scalar, y: v.y / scalar }
  }

  /**
   * ベクトルの長さを計算
   */
  static getLength(v: Vector2): number {
    return Math.sqrt(v.x * v.x + v.y * v.y)
  }

  /**
   * ベクトルの長さの二乗を計算
   */
  static lengthSquared(v: Vector2): number {
    return v.x * v.x + v.y * v.y
  }

  /**
   * ベクトルを正規化
   */
  static normalize(v: Vector2): Vector2 {
    const len = Vector2.getLength(v)
    if (len === 0) return Vector2.zero()
    return Vector2.divide(v, len)
  }

  /**
   * 内積を計算
   */
  static dot(a: Vector2, b: Vector2): number {
    return a.x * b.x + a.y * b.y
  }

  /**
   * 外積を計算（Z成分のみ）
   */
  static cross(a: Vector2, b: Vector2): number {
    return a.x * b.y - a.y * b.x
  }

  /**
   * ベクトル間の距離を計算
   */
  static distance(a: Vector2, b: Vector2): number {
    return Vector2.getLength(Vector2.subtract(a, b))
  }

  /**
   * ベクトル間の距離の二乗を計算
   */
  static distanceSquared(a: Vector2, b: Vector2): number {
    return Vector2.lengthSquared(Vector2.subtract(a, b))
  }

  /**
   * ベクトルを回転
   */
  static rotate(v: Vector2, angle: number): Vector2 {
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    return {
      x: v.x * cos - v.y * sin,
      y: v.x * sin + v.y * cos,
    }
  }

  /**
   * ベクトルの角度を計算（ラジアン）
   */
  static angle(v: Vector2): number {
    return Math.atan2(v.y, v.x)
  }

  /**
   * 2つのベクトル間の角度を計算（ラジアン）
   */
  static angleBetween(a: Vector2, b: Vector2): number {
    return Math.atan2(Vector2.cross(a, b), Vector2.dot(a, b))
  }

  /**
   * ベクトルを線形補間
   */
  static lerp(a: Vector2, b: Vector2, t: number): Vector2 {
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    }
  }

  /**
   * ベクトルが等しいかチェック
   */
  static equals(a: Vector2, b: Vector2, epsilon = 1e-6): boolean {
    return Math.abs(a.x - b.x) < epsilon && Math.abs(a.y - b.y) < epsilon
  }

  /**
   * ベクトルを文字列に変換
   */
  static toString(v: Vector2): string {
    return `(${v.x.toFixed(2)}, ${v.y.toFixed(2)})`
  }
}
