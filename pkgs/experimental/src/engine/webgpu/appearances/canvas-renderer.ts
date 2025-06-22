import type { CanvasArtObject } from '../../document/art-object'
import type { BoundingBox } from '../interfaces/IAppearanceProcessor'

/**
 * CanvasArtObjectをWebGPUで描画するレンダラー
 */
export class CanvasRenderer {
  private device: GPUDevice
  private renderPipeline: GPURenderPipeline | null = null
  private sampler: GPUSampler | null = null
  private textureCache = new Map<
    string,
    { texture: GPUTexture; width: number; height: number }
  >()
  private uniformBuffer: GPUBuffer | null = null

  constructor(device: GPUDevice) {
    this.device = device
  }

  async initialize(): Promise<void> {
    await this.createRenderPipeline()
    this.createSampler()
    this.createUniformBuffer()
  }

  private async createRenderPipeline(): Promise<void> {
    const vertexShaderCode = `
      struct CanvasUniforms {
        projectionMatrix: mat4x4<f32>,
        viewMatrix: mat4x4<f32>,
        canvasSize: vec2<f32>,
      }
      @group(0) @binding(0) var<uniform> uniforms: CanvasUniforms;

      struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) uv: vec2<f32>,
      }

      @vertex
      fn vs_main(@location(0) position: vec2<f32>, @location(1) uv: vec2<f32>) -> VertexOutput {
        var output: VertexOutput;
        
        // ワールド座標を4D同次座標に拡張
        let worldPos = vec4<f32>(position, 0.0, 1.0);
        
        // ビュー変換を適用
        let viewPos = uniforms.viewMatrix * worldPos;
        
        // プロジェクション変換を適用
        output.position = uniforms.projectionMatrix * viewPos;
        output.uv = uv;
        return output;
      }
    `

    const fragmentShaderCode = `
      @group(1) @binding(0) var textureSampler: sampler;
      @group(1) @binding(1) var canvasTexture: texture_2d<f32>;

      @fragment
      fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
        return textureSample(canvasTexture, textureSampler, uv);
      }
    `

    const vertexShader = this.device.createShaderModule({
      label: 'CanvasVertexShader',
      code: vertexShaderCode,
    })

    const fragmentShader = this.device.createShaderModule({
      label: 'CanvasFragmentShader',
      code: fragmentShaderCode,
    })

    this.renderPipeline = this.device.createRenderPipeline({
      label: 'CanvasRenderPipeline',
      layout: 'auto',
      vertex: {
        module: vertexShader,
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 4 * 4, // position(2) + uv(2) = 4 floats
            attributes: [
              {
                shaderLocation: 0,
                offset: 0,
                format: 'float32x2', // position
              },
              {
                shaderLocation: 1,
                offset: 2 * 4,
                format: 'float32x2', // uv
              },
            ],
          },
        ],
      },
      fragment: {
        module: fragmentShader,
        entryPoint: 'fs_main',
        targets: [
          {
            format: navigator.gpu.getPreferredCanvasFormat(),
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
              },
            },
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none',
      },
      multisample: {
        count: 1,
      },
    })
  }

  private createSampler(): void {
    this.sampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    })
  }

  private createUniformBuffer(): void {
    // Uniform buffer size: projectionMatrix (64) + viewMatrix (64) + canvasSize (8) = 136 bytes
    // Align to 256 bytes as per WebGPU requirements
    const uniformBufferSize = 256
    this.uniformBuffer = this.device.createBuffer({
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
  }

  /**
   * CanvasArtObjectをレンダリング
   */
  async render(
    renderPass: GPURenderPassEncoder,
    canvasArtObject: CanvasArtObject,
    projectionMatrix: Float32Array,
    viewMatrix: Float32Array,
    canvasSize: { width: number; height: number },
    _clipBounds: BoundingBox,
  ): Promise<{ buffers: GPUBuffer[] }> {
    if (!this.renderPipeline || !this.sampler || !this.uniformBuffer) {
      throw new Error('CanvasRenderer not initialized')
    }

    const buffersToDestroy: GPUBuffer[] = []

    // ビットマップデータからWebGPUテクスチャを作成
    const texture = await this.createTextureFromBitmap(canvasArtObject)
    if (!texture) {
      return { buffers: buffersToDestroy }
    }

    // uniformバッファにカメラ変換行列を書き込み
    const uniformData = new Float32Array([
      ...projectionMatrix, // 64 bytes (16 * 4)
      ...viewMatrix, // 64 bytes (16 * 4)
      canvasSize.width, // 4 bytes
      canvasSize.height, // 4 bytes
      0,
      0, // パディング 8 bytes
    ])

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData)

    // キャンバスの変形を適用してワールド座標で頂点を定義
    const transform = canvasArtObject.transform
    const worldX1 = transform.x
    const worldY1 = transform.y
    const worldX2 =
      transform.x + canvasArtObject.width * (transform.scaleX || 1)
    const worldY2 =
      transform.y + canvasArtObject.height * (transform.scaleY || 1)

    // 四角形の頂点データ（ワールド座標）
    const vertices = new Float32Array([
      // 第1三角形
      worldX1,
      worldY1,
      0.0,
      0.0, // 左上
      worldX2,
      worldY1,
      1.0,
      0.0, // 右上
      worldX1,
      worldY2,
      0.0,
      1.0, // 左下
      // 第2三角形
      worldX2,
      worldY1,
      1.0,
      0.0, // 右上
      worldX2,
      worldY2,
      1.0,
      1.0, // 右下
      worldX1,
      worldY2,
      0.0,
      1.0, // 左下
    ])

    // 頂点バッファを作成
    const vertexBuffer = this.device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    })
    new Float32Array(vertexBuffer.getMappedRange()).set(vertices)
    vertexBuffer.unmap()
    buffersToDestroy.push(vertexBuffer)

    // uniformバッファ用バインドグループを作成
    const uniformBindGroup = this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: this.uniformBuffer },
        },
      ],
    })

    // テクスチャ用バインドグループを作成
    const textureBindGroup = this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(1),
      entries: [
        {
          binding: 0,
          resource: this.sampler,
        },
        {
          binding: 1,
          resource: texture.texture.createView(),
        },
      ],
    })

    // レンダリング
    renderPass.setPipeline(this.renderPipeline)
    renderPass.setVertexBuffer(0, vertexBuffer)
    renderPass.setBindGroup(0, uniformBindGroup)
    renderPass.setBindGroup(1, textureBindGroup)
    renderPass.draw(6) // 6個の頂点で2つの三角形

    return { buffers: buffersToDestroy }
  }

  /**
   * ビットマップデータからWebGPUテクスチャを作成
   */
  private async createTextureFromBitmap(
    canvasArtObject: CanvasArtObject,
  ): Promise<{ texture: GPUTexture; width: number; height: number } | null> {
    const { bitmap, width, height } = canvasArtObject

    // キャッシュキーを生成
    const cacheKey = `${canvasArtObject.id}-${width}-${height}`

    // キャッシュから取得を試行
    const cached = this.textureCache.get(cacheKey)
    if (cached) {
      return cached
    }

    let imageData: ImageData

    if (!bitmap) {
      // ビットマップがない場合は透明なキャンバスを作成
      imageData = new ImageData(width, height)
    } else if (bitmap instanceof ImageData) {
      imageData = bitmap
    } else if (bitmap instanceof HTMLCanvasElement) {
      // HTMLCanvasElementからImageDataを取得
      const ctx = bitmap.getContext('2d')
      if (!ctx) {
        return null
      }
      imageData = ctx.getImageData(0, 0, width, height)
    } else if (bitmap instanceof Uint8Array) {
      // Uint8ArrayからImageDataを作成
      imageData = new ImageData(new Uint8ClampedArray(bitmap), width, height)
    } else {
      return null
    }

    // WebGPUテクスチャを作成
    const texture = this.device.createTexture({
      size: { width, height },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    })

    // ImageDataをテクスチャにコピー
    this.device.queue.writeTexture(
      { texture },
      imageData.data,
      { bytesPerRow: width * 4 },
      { width, height },
    )

    const result = { texture, width, height }

    // キャッシュに保存
    this.textureCache.set(cacheKey, result)

    return result
  }

  /**
   * キャンバスArtObjectに対してブラシストロークを適用
   */
  async applyBrushStroke(
    canvasArtObject: CanvasArtObject,
    strokePoints: { x: number; y: number; pressure?: number }[],
    brushSettings: {
      size: number
      color: { r: number; g: number; b: number; a: number }
      hardness?: number
    },
  ): Promise<void> {
    if (!canvasArtObject.bitmap) {
      // ビットマップがない場合は新しく作成
      canvasArtObject.bitmap = new ImageData(
        canvasArtObject.width,
        canvasArtObject.height,
      )
    }

    // 履歴を保存
    this.saveToHistory(canvasArtObject)

    // HTML5 Canvasを使用してブラシストロークを描画
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = canvasArtObject.width
    tempCanvas.height = canvasArtObject.height
    const ctx = tempCanvas.getContext('2d')

    if (!ctx) {
      throw new Error('Failed to get 2D context')
    }

    // 既存のビットマップを描画
    if (canvasArtObject.bitmap instanceof ImageData) {
      ctx.putImageData(canvasArtObject.bitmap, 0, 0)
    } else if (canvasArtObject.bitmap instanceof HTMLCanvasElement) {
      ctx.drawImage(canvasArtObject.bitmap, 0, 0)
    }

    // ブラシ設定を適用
    const { r, g, b, a } = brushSettings.color
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = `rgba(${Math.round(r * 255)}, ${Math.round(
      g * 255,
    )}, ${Math.round(b * 255)}, ${a})`
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // ストロークを描画
    if (strokePoints.length > 0) {
      ctx.beginPath()
      const firstPoint = strokePoints[0]

      // キャンバス座標からローカル座標に変換
      const localX = firstPoint.x - canvasArtObject.transform.x
      const localY = firstPoint.y - canvasArtObject.transform.y

      ctx.moveTo(localX, localY)

      for (let i = 1; i < strokePoints.length; i++) {
        const point = strokePoints[i]
        const localX = point.x - canvasArtObject.transform.x
        const localY = point.y - canvasArtObject.transform.y

        // 筆圧に基づいてブラシサイズを調整
        const pressure = point.pressure || 1.0
        ctx.lineWidth = brushSettings.size * pressure

        ctx.lineTo(localX, localY)
      }

      ctx.stroke()
    }

    // 更新されたImageDataを取得
    const newImageData = ctx.getImageData(
      0,
      0,
      canvasArtObject.width,
      canvasArtObject.height,
    )
    canvasArtObject.bitmap = newImageData

    // テクスチャキャッシュを無効化
    const cacheKey = `${canvasArtObject.id}-${canvasArtObject.width}-${canvasArtObject.height}`
    this.textureCache.delete(cacheKey)
  }

  /**
   * 履歴を保存
   */
  private saveToHistory(canvasArtObject: CanvasArtObject): void {
    if (!canvasArtObject.history) {
      canvasArtObject.history = []
    }

    // 現在のビットマップを履歴に保存
    if (canvasArtObject.bitmap instanceof ImageData) {
      const historyData = new ImageData(
        new Uint8ClampedArray(canvasArtObject.bitmap.data),
        canvasArtObject.bitmap.width,
        canvasArtObject.bitmap.height,
      )

      canvasArtObject.history.push(historyData)
      canvasArtObject.historyIndex = (canvasArtObject.historyIndex || -1) + 1

      // 最大履歴数を超えた場合は古いものを削除
      const maxHistory = canvasArtObject.maxHistory || 10
      if (canvasArtObject.history.length > maxHistory) {
        canvasArtObject.history.shift()
        canvasArtObject.historyIndex--
      }
    }
  }

  /**
   * リソースを解放
   */
  dispose(): void {
    // テクスチャキャッシュをクリア
    for (const cached of this.textureCache.values()) {
      cached.texture.destroy()
    }
    this.textureCache.clear()

    // uniformバッファを解放
    if (this.uniformBuffer) {
      this.uniformBuffer.destroy()
      this.uniformBuffer = null
    }
  }
}
