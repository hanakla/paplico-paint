export class TextureLoader {
  private device: GPUDevice
  private textureCache = new Map<string, GPUTexture>()

  constructor(device: GPUDevice) {
    this.device = device
  }

  async loadTexture(url: string): Promise<GPUTexture> {
    if (this.textureCache.has(url)) {
      return this.textureCache.get(url)!
    }

    try {
      // 画像を読み込み
      const response = await fetch(url)
      const blob = await response.blob()
      const imageBitmap = await createImageBitmap(blob)

      // WebGPUテクスチャを作成
      const texture = this.device.createTexture({
        label: `BrushTexture_${url.split('/').pop()}`,
        size: [imageBitmap.width, imageBitmap.height, 1],
        format: 'rgba8unorm',
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.RENDER_ATTACHMENT,
      })

      // 画像データをテクスチャにコピー
      this.device.queue.copyExternalImageToTexture(
        { source: imageBitmap },
        { texture: texture },
        [imageBitmap.width, imageBitmap.height],
      )

      this.textureCache.set(url, texture)

      return texture
    } catch (_error) {
      // フォールバック用の1x1白テクスチャを作成
      return this.createFallbackTexture()
    }
  }

  private createFallbackTexture(): GPUTexture {
    const texture = this.device.createTexture({
      label: 'FallbackBrushTexture',
      size: [1, 1, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    })

    // 白い1x1ピクセルを書き込み
    const data = new Uint8Array([255, 255, 255, 255])
    this.device.queue.writeTexture(
      { texture },
      data,
      { bytesPerRow: 4 },
      [1, 1],
    )

    return texture
  }

  destroy() {
    this.textureCache.forEach((texture) => texture.destroy())
    this.textureCache.clear()
  }
}
