import { VectorPath, Vector2 } from '../../state'
import {
  IAppearanceProcessor,
  BoundingBox,
} from '../interfaces/IAppearanceProcessor'
import { StrokeAppearance } from '../../document/appearance'
import { debugLogger } from '../../../utils/debug-logger'
import { airBrush, pencil } from '../../assets'
import {
  createTextureFromImage,
  makeShaderDataDefinitions,
  makeStructuredView,
  createBuffersAndAttributesFromArrays,
} from 'webgpu-utils'

export interface StrokeInstance {
  position: Vector2
  size: number
  rotation: number
  opacity: number
  scale: number
}

export interface BrushSettings {
  texture: string
  divisions: number
  scatterRange: number
  rotationAdjust: number
  randomRotation: number
  randomScale: number
  inOutInfluence: number
  inOutLength: number
  pressureInfluence: number
  noiseInfluence: number
}

export class StrokeRenderer implements IAppearanceProcessor {
  private device: GPUDevice
  private renderPipeline: GPURenderPipeline | null = null
  private bindGroupLayout: GPUBindGroupLayout | null = null
  private shaderDataDefinitions: any = null

  // テクスチャとサンプラー
  private currentTexture: GPUTexture | null = null
  private sampler: GPUSampler
  private textureCache: Map<string, GPUTexture> = new Map()

  // Uniform管理
  private uniformsView: any = null
  private uniformBuffer: GPUBuffer | null = null

  // インスタンス用バッファ
  private instanceData: any = null
  private instanceBuffer: GPUBuffer | null = null
  private maxInstances = 10000

  // ブラシ設定
  private brushSettings: BrushSettings = {
    texture: 'pencil',
    divisions: 1000,
    scatterRange: 0.5,
    rotationAdjust: 1,
    randomRotation: 0,
    randomScale: 0,
    inOutInfluence: 1,
    inOutLength: 100,
    pressureInfluence: 0.8,
    noiseInfluence: 0,
  }

  constructor(device: GPUDevice) {
    this.device = device

    // サンプラーを作成
    this.sampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    })
  }

  async initialize() {
    await this.createRenderPipeline()
    this.createInstanceBuffer()
    this.createUniforms()
  }

  private async createRenderPipeline() {
    const shaderCode = `
      struct BrushUniforms {
        viewMatrix: mat4x4f,
        canvasSize: vec2f,
        brushColor: vec4f,
      }

      struct VertexInput {
        @location(0) position: vec2<f32>,
        @location(1) texCoord: vec2<f32>,
      }

      struct InstanceInput {
        @location(2) instancePosition: vec2<f32>,
        @location(3) instanceSize: f32,
        @location(4) instanceRotation: f32,
        @location(5) instanceOpacity: f32,
        @location(6) instanceScale: f32,
      }

      struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) texCoord: vec2<f32>,
        @location(1) opacity: f32,
      }

      @group(0) @binding(0) var brushTexture: texture_2d<f32>;
      @group(0) @binding(1) var brushSampler: sampler;
      @group(0) @binding(2) var<uniform> uniforms: BrushUniforms;

      @vertex
      fn vs_main(vertex: VertexInput, instance: InstanceInput) -> VertexOutput {
        var output: VertexOutput;

        // 回転行列を適用
        let cos_r = cos(instance.instanceRotation);
        let sin_r = sin(instance.instanceRotation);
        let rotatedPos = vec2<f32>(
          vertex.position.x * cos_r - vertex.position.y * sin_r,
          vertex.position.x * sin_r + vertex.position.y * cos_r
        );

        // スケールと位置を適用
        let worldPos = rotatedPos * instance.instanceSize * instance.instanceScale + instance.instancePosition;

        // カメラ変換を適用
        let transformedPos = (uniforms.viewMatrix * vec4f(worldPos, 0.0, 1.0)).xy;
        
        // NDC座標に変換
        let ndcPos = vec2f(
          transformedPos.x / uniforms.canvasSize.x * 2.0,
          -transformedPos.y / uniforms.canvasSize.y * 2.0
        );

        output.position = vec4<f32>(ndcPos, 0.0, 1.0);
        output.texCoord = vertex.texCoord;
        output.opacity = instance.instanceOpacity;

        return output;
      }

      struct FragmentInput {
        @location(0) texCoord: vec2<f32>,
        @location(1) opacity: f32,
      }

      @fragment
      fn fs_main(input: FragmentInput) -> @location(0) vec4<f32> {
        let texSample = textureSample(brushTexture, brushSampler, input.texCoord);

        // グレースケール値をアルファとして使用（黒=透明、白=不透明）
        let alpha = texSample.r * uniforms.brushColor.a * input.opacity;

        return vec4<f32>(uniforms.brushColor.rgb, alpha);
      }
    `

    // webgpu-utilsでシェーダーデータ定義を解析
    this.shaderDataDefinitions = makeShaderDataDefinitions(shaderCode)

    // ユニフォーム構造化ビューを作成
    this.uniformsView = makeStructuredView(
      this.shaderDataDefinitions.uniforms.uniforms,
    )

    const shaderModule = this.device.createShaderModule({
      label: 'BrushShader',
      code: shaderCode,
    })

    // 明示的な頂点バッファレイアウトを定義
    const pipelineDescriptor = {
      label: 'BrushRenderPipeline',
      layout: 'auto' as const,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [
          // Buffer 0: Vertex attributes (position, texCoord)
          {
            arrayStride: 4 * 4, // vec2 + vec2 = 4 floats
            attributes: [
              {
                shaderLocation: 0, // position
                offset: 0,
                format: 'float32x2' as const,
              },
              {
                shaderLocation: 1, // texCoord
                offset: 2 * 4,
                format: 'float32x2' as const,
              },
            ],
          },
          // Buffer 1: Instance attributes
          {
            arrayStride: 6 * 4, // 2 + 1 + 1 + 1 + 1 = 6 floats
            stepMode: 'instance' as const,
            attributes: [
              {
                shaderLocation: 2, // instancePosition
                offset: 0,
                format: 'float32x2' as const,
              },
              {
                shaderLocation: 3, // instanceSize
                offset: 2 * 4,
                format: 'float32' as const,
              },
              {
                shaderLocation: 4, // instanceRotation
                offset: 3 * 4,
                format: 'float32' as const,
              },
              {
                shaderLocation: 5, // instanceOpacity
                offset: 4 * 4,
                format: 'float32' as const,
              },
              {
                shaderLocation: 6, // instanceScale
                offset: 5 * 4,
                format: 'float32' as const,
              },
            ],
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [
          {
            format: navigator.gpu.getPreferredCanvasFormat(),
            blend: {
              color: {
                srcFactor: 'src-alpha' as const,
                dstFactor: 'one-minus-src-alpha' as const,
              },
              alpha: {
                srcFactor: 'one' as const,
                dstFactor: 'one-minus-src-alpha' as const,
              },
            },
          },
        ],
      },
      primitive: {
        topology: 'triangle-list' as const,
        cullMode: 'none' as const,
      },
    }

    this.renderPipeline = this.device.createRenderPipeline(pipelineDescriptor)

    // バインドグループレイアウトを取得
    this.bindGroupLayout = this.renderPipeline?.getBindGroupLayout(0) || null
  }

  private createInstanceBuffer() {
    this.instanceBuffer = this.device.createBuffer({
      label: 'StrokeInstanceBuffer',
      size: this.maxInstances * 6 * 4, // 6 floats per instance
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    })
  }

  private createUniforms() {
    if (!this.uniformsView) {
      return
    }

    this.uniformBuffer = this.device.createBuffer({
      label: 'StrokeUniformBuffer',
      size: this.uniformsView.arrayBuffer.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
  }

  async loadBrushTexture(textureName: string): Promise<void> {
    if (this.textureCache.has(textureName)) {
      this.currentTexture = this.textureCache.get(textureName)!
      return
    }

    try {
      // assets/index.tsからBase64エンコードされたテクスチャを取得
      let base64Data: string
      switch (textureName) {
        case 'pencil':
          base64Data = pencil
          break
        case 'airbrush':
          base64Data = airBrush
          break
        default:
          throw new Error(`Unknown brush texture: ${textureName}`)
      }

      const dataUrl = `data:image/png;base64,${base64Data}`

      // webgpu-utilsでテクスチャを読み込み
      const texture = await createTextureFromImage(this.device, dataUrl, {
        mips: true,
        flipY: false, // ブラシテクスチャでは反転不要
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      })

      this.textureCache.set(textureName, texture)
      this.currentTexture = texture
    } catch (error) {
      throw error
    }
  }

  createStrokeInstancesFromPath(
    path: VectorPath,
    strokeSize: number,
  ): StrokeInstance[] {
    return createStrokeInstances(path, strokeSize, this.brushSettings)
  }

  async render(
    renderPass: GPURenderPassEncoder,
    path: VectorPath,
    appearance: StrokeAppearance,
    _projectionMatrix: Float32Array,
    viewMatrix: Float32Array,
    canvasSize: { width: number; height: number },
    inputBounds: BoundingBox,
  ): Promise<{ buffers: GPUBuffer[]; bounds: BoundingBox }> {
    if (!this.renderPipeline || !this.bindGroupLayout) {
      return { buffers: [], bounds: inputBounds }
    }

    // StrokeAppearanceからパラメータを取得
    const strokeWidth = appearance.params.width
    const strokeTexture = 'pencil' // TODO: appearanceから取得

    // ストロークテクスチャをロード（キャッシュされる）
    await this.loadBrushTexture(strokeTexture)

    if (!this.currentTexture) {
      return { buffers: [], bounds: inputBounds }
    }

    // ストロークインスタンスを生成
    const instances = this.createStrokeInstancesFromPath(path, strokeWidth)

    if (instances.length === 0) {
      return { buffers: [], bounds: inputBounds }
    }

    // インスタンスデータを単一のインターリーブドバッファに作成
    try {
      const interleavedData = new Float32Array(instances.length * 6) // 6 floats per instance

      for (let i = 0; i < instances.length; i++) {
        const instance = instances[i]
        const offset = i * 6

        interleavedData[offset + 0] = instance.position.x // instancePosition.x
        interleavedData[offset + 1] = instance.position.y // instancePosition.y
        interleavedData[offset + 2] = instance.size // instanceSize
        interleavedData[offset + 3] = instance.rotation // instanceRotation
        interleavedData[offset + 4] = instance.opacity // instanceOpacity
        interleavedData[offset + 5] = instance.scale // instanceScale
      }

      // バッファを作成
      const instanceBuffer = this.device.createBuffer({
        label: 'StrokeInstanceBuffer',
        size: interleavedData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      })

      // データを書き込み
      this.device.queue.writeBuffer(instanceBuffer, 0, interleavedData)

      this.instanceData = {
        buffer: instanceBuffer,
        numInstances: instances.length,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined

      throw error
    }

    // ユニフォームデータを設定
    if (!this.uniformsView || !this.uniformBuffer) {
      return { buffers: [], bounds: inputBounds }
    }

    this.uniformsView.set({
      viewMatrix: viewMatrix,
      canvasSize: [canvasSize.width, canvasSize.height],
      brushColor: [path.color.r, path.color.g, path.color.b, path.color.a],
    })

    // ユニフォームバッファを更新
    this.device.queue.writeBuffer(
      this.uniformBuffer,
      0,
      this.uniformsView.arrayBuffer,
    )

    // バインドグループを作成
    const bindGroup = this.device.createBindGroup({
      label: 'BrushBindGroup',
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: this.currentTexture.createView() },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: { buffer: this.uniformBuffer } },
      ],
    })

    // webgpu-utilsでクアッド頂点データを作成
    let quadData: any
    try {
      quadData = createBuffersAndAttributesFromArrays(this.device, {
        position: {
          data: new Float32Array([
            -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5,
          ]),
          numComponents: 2,
        },
        texCoord: {
          data: new Float32Array([
            0.0, 1.0, 1.0, 1.0, 1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0,
          ]),
          numComponents: 2,
        },
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined

      throw error
    }

    // 描画
    renderPass.setPipeline(this.renderPipeline)
    renderPass.setBindGroup(0, bindGroup)

    // 頂点バッファを設定 (quad - buffer 0)
    for (let i = 0; i < quadData.buffers.length; i++) {
      renderPass.setVertexBuffer(i, quadData.buffers[i])
    }

    // インスタンスバッファを設定 (buffer 1)
    renderPass.setVertexBuffer(1, this.instanceData.buffer)

    renderPass.draw(quadData.numElements, this.instanceData.numInstances)

    // バッファを返却（呼び出し元で破棄）
    const updatedBounds = this.calculateBounds(path, appearance, inputBounds)
    const buffers = [...quadData.buffers, this.instanceData.buffer]
    return { buffers, bounds: updatedBounds }
  }

  /**
   * ストロークアピアランスが適用される予想バウンディングボックスを計算する
   */
  calculateBounds(
    path: VectorPath,
    appearance: StrokeAppearance,
    inputBounds: BoundingBox,
  ): BoundingBox {
    if (path.points.length === 0) {
      return inputBounds
    }

    const strokeWidth = appearance.params.width
    const halfWidth = strokeWidth / 2

    // パスの最小・最大座標を計算（ストローク幅を考慮）
    let minX = Infinity,
      minY = Infinity
    let maxX = -Infinity,
      maxY = -Infinity

    for (const point of path.points) {
      minX = Math.min(minX, point.x - halfWidth)
      minY = Math.min(minY, point.y - halfWidth)
      maxX = Math.max(maxX, point.x + halfWidth)
      maxY = Math.max(maxY, point.y + halfWidth)
    }

    const strokeBounds: BoundingBox = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    }

    // inputBoundsと結合（union）
    if (inputBounds.width === 0 && inputBounds.height === 0) {
      return strokeBounds
    }

    const combinedMinX = Math.min(inputBounds.x, strokeBounds.x)
    const combinedMinY = Math.min(inputBounds.y, strokeBounds.y)
    const combinedMaxX = Math.max(
      inputBounds.x + inputBounds.width,
      strokeBounds.x + strokeBounds.width,
    )
    const combinedMaxY = Math.max(
      inputBounds.y + inputBounds.height,
      strokeBounds.y + strokeBounds.height,
    )

    return {
      x: combinedMinX,
      y: combinedMinY,
      width: combinedMaxX - combinedMinX,
      height: combinedMaxY - combinedMinY,
    }
  }

  setBrushSettings(settings: Partial<BrushSettings>) {
    this.brushSettings = { ...this.brushSettings, ...settings }
  }

  getBrushSettings(): BrushSettings {
    return { ...this.brushSettings }
  }

  destroy() {
    this.instanceBuffer?.destroy()
    this.uniformBuffer?.destroy()

    // テクスチャキャッシュをクリア
    for (const texture of this.textureCache.values()) {
      texture.destroy()
    }
    this.textureCache.clear()
  }
}

/**
 * パスからストロークインスタンスを生成する独立関数
 * パフォーマンステスト用に外部からテスト可能
 */
export function createStrokeInstances(
  path: VectorPath,
  strokeSize: number,
  brushSettings: BrushSettings,
): StrokeInstance[] {
  const instances: StrokeInstance[] = []

  if (path.points.length === 0) {
    return instances
  }

  // パス全体の長さを計算
  let totalLength = 0
  const segments: { length: number; dx: number; dy: number; start: Vector2 }[] =
    []

  for (let i = 0; i < path.points.length - 1; i++) {
    const p1 = path.points[i]
    const p2 = path.points[i + 1]
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    const length = Math.sqrt(dx * dx + dy * dy)

    segments.push({ length, dx, dy, start: p1 })
    totalLength += length
  }

  if (totalLength === 0) {
    return instances
  }

  // ブラシインスタンスの間隔を決定
  const baseSpacing = Math.max(strokeSize * 0.1, 1.0)
  const instanceCount = Math.ceil(totalLength / baseSpacing)
  const actualSpacing = totalLength / instanceCount

  // パス上にインスタンスを配置
  let currentLength = 0
  let segmentIndex = 0

  for (let i = 0; i <= instanceCount; i++) {
    const targetLength = i * actualSpacing

    // 現在のセグメントを進める
    while (
      segmentIndex < segments.length &&
      currentLength + segments[segmentIndex].length < targetLength
    ) {
      currentLength += segments[segmentIndex].length
      segmentIndex++
    }

    if (segmentIndex >= segments.length) break

    const segment = segments[segmentIndex]
    const remainingLength = targetLength - currentLength
    const t = segment.length > 0 ? remainingLength / segment.length : 0

    const x = segment.start.x + segment.dx * t
    const y = segment.start.y + segment.dy * t
    const rotation = Math.atan2(segment.dy, segment.dx)

    // パス全体における進行度（0-1）
    const progress = targetLength / totalLength

    // in/out効果を計算
    const inOutScale = calculateInOutScale(progress, totalLength, brushSettings)

    // ランダムスケール
    const randomScale = 1 + (Math.random() - 0.5) * brushSettings.randomScale

    // ランダム回転
    const randomRotation =
      (Math.random() - 0.5) * brushSettings.randomRotation * Math.PI

    // スキャッタリング
    const scatterX = (Math.random() - 0.5) * brushSettings.scatterRange
    const scatterY = (Math.random() - 0.5) * brushSettings.scatterRange

    instances.push({
      position: {
        x: x + scatterX,
        y: y + scatterY,
      },
      size: strokeSize * 0.01 * inOutScale * randomScale,
      rotation: rotation * brushSettings.rotationAdjust + randomRotation,
      opacity: 1.0,
      scale: inOutScale * randomScale,
    })
  }

  return instances
}

/**
 * in/out効果のスケール計算を独立関数として抽出
 */
function calculateInOutScale(
  progress: number,
  totalLength: number,
  brushSettings: BrushSettings,
): number {
  const { inOutInfluence, inOutLength } = brushSettings

  if (inOutLength === 0) return 1

  const inOutLengthNormalized = inOutLength / totalLength

  if (progress <= inOutLengthNormalized) {
    // フェードイン
    return (
      inOutInfluence + (1 - inOutInfluence) * (progress / inOutLengthNormalized)
    )
  } else if (progress >= 1 - inOutLengthNormalized) {
    // フェードアウト
    const fadeProgress = (1 - progress) / inOutLengthNormalized
    return inOutInfluence + (1 - inOutInfluence) * fadeProgress
  } else {
    // 中間部分
    return 1
  }
}
