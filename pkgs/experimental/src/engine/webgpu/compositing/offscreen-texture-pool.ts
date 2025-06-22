import type { BoundingBox } from '../interfaces/IAppearanceProcessor'

/**
 * オフスクリーンテクスチャのプール管理
 * メモリ効率を向上させるために、使用済みテクスチャを再利用
 */
export class OffscreenTexturePool {
  private device: GPUDevice
  private availableTextures: Map<string, GPUTexture[]> = new Map()
  private usedTextures: Set<GPUTexture> = new Set()

  constructor(device: GPUDevice) {
    this.device = device
  }

  /**
   * 指定サイズのオフスクリーンテクスチャを取得
   * プールにある場合は再利用、ない場合は新規作成
   */
  acquireTexture(width: number, height: number): GPUTexture {
    const key = `${width}x${height}`
    const pool = this.availableTextures.get(key) || []

    let texture: GPUTexture
    if (pool.length > 0) {
      // プールから再利用
      texture = pool.pop()!
    } else {
      // 新規作成
      texture = this.device.createTexture({
        label: `OffscreenTexture_${key}`,
        size: { width, height },
        format: 'rgba8unorm',
        usage:
          GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      })
    }

    this.usedTextures.add(texture)
    return texture
  }

  /**
   * バウンディングボックスに基づいてテクスチャを取得
   */
  acquireTextureForBounds(bounds: BoundingBox): GPUTexture {
    const width = Math.max(1, Math.ceil(bounds.width))
    const height = Math.max(1, Math.ceil(bounds.height))
    return this.acquireTexture(width, height)
  }

  /**
   * テクスチャをプールに返却
   */
  releaseTexture(texture: GPUTexture): void {
    if (!this.usedTextures.has(texture)) {
      return
    }

    this.usedTextures.delete(texture)

    // テクスチャサイズからキーを復元
    const width = texture.width
    const height = texture.height
    const key = `${width}x${height}`

    if (!this.availableTextures.has(key)) {
      this.availableTextures.set(key, [])
    }
    this.availableTextures.get(key)?.push(texture)
  }

  /**
   * 使用中の全テクスチャをプールに返却
   */
  releaseAllTextures(): void {
    for (const texture of this.usedTextures) {
      const width = texture.width
      const height = texture.height
      const key = `${width}x${height}`

      if (!this.availableTextures.has(key)) {
        this.availableTextures.set(key, [])
      }
      this.availableTextures.get(key)?.push(texture)
    }
    this.usedTextures.clear()
  }

  /**
   * 全テクスチャを破棄してプールをクリア
   */
  destroy(): void {
    // 使用中のテクスチャを破棄
    for (const texture of this.usedTextures) {
      texture.destroy()
    }
    this.usedTextures.clear()

    // プール内のテクスチャを破棄
    for (const textures of this.availableTextures.values()) {
      for (const texture of textures) {
        texture.destroy()
      }
    }
    this.availableTextures.clear()
  }
}
