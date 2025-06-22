import {
  createTextureFromImage,
  makeShaderDataDefinitions,
  makeStructuredView,
} from 'webgpu-utils'
import { AppearanceError, EngineError, ErrorCode } from '@/engine/exceptions'
import { airBrush, pencil } from '../../assets'
import type { StrokeAppearance } from '../../document/appearance'
import type { VectorPath } from '../../document/path'
import type { Vector2 } from '../../state'
import { debugState } from '../core-engine'
import type {
  BoundingBox,
  IAppearanceProcessor,
} from '../interfaces/IAppearanceProcessor'

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
  scatterConfig?: {
    count: number
    spread: number
    sizeVariation: number
    opacityVariation: number
  }
  rotationAdjust: number
  randomRotation: number
  randomScale: number
  inOutInfluence: number
  inOutLength: number
  pressureInfluence: number
  noiseInfluence: number
  pressureSizeInfluence?: number
  pressureOpacityInfluence?: number
  tiltInfluence?: number
  velocitySizeInfluence?: number
  velocityOpacityInfluence?: number
  minSizeRatio?: number
  minOpacity?: number
}

export class StrokeRenderer implements IAppearanceProcessor {
  private device: GPUDevice
  private renderPipeline: GPURenderPipeline | null = null
  private bindGroupLayout: GPUBindGroupLayout | null = null
  private sampler: GPUSampler
  private uniformBuffer: GPUBuffer | null = null
  private uniformsView: any = null
  private instanceBuffer: GPUBuffer | null = null
  private maxInstances = 1000000
  private textureCache = new Map<string, GPUTexture>()
  private currentTexture: GPUTexture | null = null

  // GPU Compute Pipeline関連
  private computePipeline: GPUComputePipeline | null = null
  private computeBindGroupLayout: GPUBindGroupLayout | null = null
  private computeShaderDataDefinitions: any = null
  private pathDataBuffer: GPUBuffer | null = null
  private brushParamsBuffer: GPUBuffer | null = null
  private instanceOutputBuffer: GPUBuffer | null = null
  private computeUniformBuffer: GPUBuffer | null = null
  private maxPathPoints = 10000
  private isGPUComputeAvailable = true

  private brushSettings: BrushSettings = {
    texture: 'pencil',
    divisions: 1000,
    scatterConfig: {
      count: 5,
      spread: 0.5,
      sizeVariation: 0.2,
      opacityVariation: 0.1,
    },
    rotationAdjust: 1,
    randomRotation: 0,
    randomScale: 0,
    inOutInfluence: 1,
    inOutLength: 100,
    pressureInfluence: 0.8,
    noiseInfluence: 0,
    pressureSizeInfluence: 0.8,
    pressureOpacityInfluence: 0.6,
    tiltInfluence: 0.3,
    velocitySizeInfluence: 0.4,
    velocityOpacityInfluence: 0.2,
    minSizeRatio: 0.1,
    minOpacity: 0.1,
  }

  constructor(device: GPUDevice) {
    this.device = device

    // サンプラーを作成
    this.sampler = this.device.createSampler({
      magFilter: 'nearest',
      minFilter: 'nearest',
      mipmapFilter: 'nearest',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    })
  }

  async initialize() {
    // WebGPU Compute機能の利用可能性をチェック
    // if (!this.device.features?.has('bgra8unorm-storage')) {
    //   // throw new AppearanceError(
    //   //   'StrokeRenderer: WebGPU Compute is not supported',
    //   // )
    // }

    await this.createRenderPipeline()
    await this.createComputePipeline()
    this.createInstanceBuffer()
    this.createUniforms()
    this.createComputeBuffers()

    // テクスチャを事前ロードしてピクセル分析を実行
    await this.loadBrushTexture('pencil')
  }

  private async createRenderPipeline() {
    try {
      const shaderCode = `
      struct BrushUniforms {
        projectionMatrix: mat4x4f,  // 64 bytes (16-byte aligned)
        viewMatrix: mat4x4f,        // 64 bytes (16-byte aligned)
        canvasSize: vec2f,          // 8 bytes + 8 bytes padding = 16 bytes
        brushColor: vec4f,          // 16 bytes (16-byte aligned)
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
      @group(0) @binding(2) var<uniform> brushUniforms: BrushUniforms;

      @vertex
      fn vs_main(vertex: VertexInput, instance: InstanceInput) -> VertexOutput {
        var output: VertexOutput;

        // サイズが0の場合は面積をゼロにして非表示にする
        if (instance.instanceSize <= 0.0 || instance.instanceOpacity <= 0.0) {
          output.position = vec4<f32>(0.0, 0.0, 0.0, 0.0);
          output.texCoord = vec2<f32>(0.0, 0.0);
          output.opacity = 0.0;
          return output;
        }

        // 回転行列を適用
        let cos_r = cos(instance.instanceRotation);
        let sin_r = sin(instance.instanceRotation);
        let rotatedPos = vec2<f32>(
          vertex.position.x * cos_r - vertex.position.y * sin_r,
          vertex.position.x * sin_r + vertex.position.y * cos_r
        );

        // スケールとサイズを適用
        let scaledPos = rotatedPos * instance.instanceSize * instance.instanceScale;
        let worldPos = scaledPos + instance.instancePosition;

        // プロジェクション変換
        let mvpMatrix = brushUniforms.projectionMatrix * brushUniforms.viewMatrix;
        output.position = mvpMatrix * vec4<f32>(worldPos, 0.0, 1.0);
        output.texCoord = vec2<f32>(vertex.texCoord.x, 1.0 - vertex.texCoord.y);
        output.opacity = instance.instanceOpacity;

        return output;
      }

      @fragment
      fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
        // 不透明度が0の場合はピクセルを破棄
        if (input.opacity <= 0.0) {
          discard;
        }

        let texColor = textureSample(brushTexture, brushSampler, input.texCoord);

        // テクスチャはグレースケール値をRGBに持つアルファマップ
        // 輝度値を計算（グレースケール値）
        let luminance = (texColor.r + texColor.g + texColor.b) / 3.0;

        // 分析結果に基づく適切な閾値: グレー値30/255 = 0.118
        let textureAlpha = step(0.118, luminance);

        // 最終アルファ値を計算
        let alpha = textureAlpha * input.opacity * brushUniforms.brushColor.a;

        // アルファが0の場合は破棄
        if (alpha <= 0.0) {
          discard;
        }

        // ブラシカラーを適用
        let finalColor = brushUniforms.brushColor.rgb;
        return vec4<f32>(finalColor, alpha);
      }
    `

      // webgpu-utilsでシェーダーデータ定義を作成
      try {
        const defs = makeShaderDataDefinitions(shaderCode)
        debugState.stroke.webgpuUtils.shaderDataDefs = defs
        debugState.stroke.webgpuUtils.uniformsAvailable = defs.uniforms
          ? Object.keys(defs.uniforms)
          : []
        debugState.stroke.webgpuUtils.structsAvailable = defs.structs
          ? Object.keys(defs.structs)
          : []

        if (defs.uniforms && Object.keys(defs.uniforms).length > 0) {
          const firstUniformKey = Object.keys(defs.uniforms)[0]
          this.uniformsView = makeStructuredView(defs.uniforms[firstUniformKey])
          debugState.stroke.webgpuUtils.uniformsView = 'created'
        } else {
          this.uniformsView = null
          debugState.stroke.webgpuUtils.uniformsView = 'no uniforms found'
        }
      } catch (error) {
        debugState.stroke.webgpuUtils.lastParseError =
          error instanceof Error ? error.message : String(error)
        this.uniformsView = null
      }

      const shaderModule = this.device.createShaderModule({
        label: 'StrokeShader',
        code: shaderCode,
      })

      // バインドグループレイアウトを作成
      this.bindGroupLayout = this.device.createBindGroupLayout({
        label: 'StrokeBindGroupLayout',
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { sampleType: 'float' },
          },
          {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {},
          },
          {
            binding: 2,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: { type: 'uniform' },
          },
        ],
      })

      // レンダーパイプラインを作成
      this.renderPipeline = this.device.createRenderPipeline({
        label: 'StrokeRenderPipeline',
        layout: this.device.createPipelineLayout({
          bindGroupLayouts: [this.bindGroupLayout],
        }),
        vertex: {
          module: shaderModule,
          entryPoint: 'vs_main',
          buffers: [
            {
              arrayStride: 4 * 4, // vec2 position + vec2 texCoord
              attributes: [
                { shaderLocation: 0, offset: 0, format: 'float32x2' },
                { shaderLocation: 1, offset: 8, format: 'float32x2' },
              ],
            },
            {
              arrayStride: 6 * 4, // インスタンスデータ
              stepMode: 'instance',
              attributes: [
                { shaderLocation: 2, offset: 0, format: 'float32x2' }, // position
                { shaderLocation: 3, offset: 8, format: 'float32' }, // size
                { shaderLocation: 4, offset: 12, format: 'float32' }, // rotation
                { shaderLocation: 5, offset: 16, format: 'float32' }, // opacity
                { shaderLocation: 6, offset: 20, format: 'float32' }, // scale
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
      })
    } catch (error) {
      throw new AppearanceError(
        'StrokeRenderer: Failed to create render pipeline',
        { cause: error },
      )
    }
  }

  private async createComputePipeline() {
    const computeShaderCode = `
      struct PathPoint {
        x: f32,
        y: f32,
        pressure: f32,
        tiltX: f32,
        tiltY: f32,
        velocity: f32,
        padding: array<f32, 2>,
      }

      struct BrushParams {
        strokeSize: f32,
        randomScale: f32,
        randomRotation: f32,
        rotationAdjust: f32,
        scatterSpread: f32,
        scatterSizeVariation: f32,
        scatterOpacityVariation: f32,
        inOutInfluence: f32,
        inOutLength: f32,
        pressureSizeInfluence: f32,
        pressureOpacityInfluence: f32,
        tiltInfluence: f32,
        velocitySizeInfluence: f32,
        velocityOpacityInfluence: f32,
        minSizeRatio: f32,
        minOpacity: f32,
      }

      struct ComputeUniforms {
        numPathPoints: u32,
        seed: u32,
        baseSpacing: f32,
        totalLength: f32,
      }

      struct StrokeInstance {
        positionX: f32,
        positionY: f32,
        size: f32,
        rotation: f32,
        opacity: f32,
        scale: f32,
      }

      @group(0) @binding(0) var<storage, read> pathPoints: array<PathPoint>;
      @group(0) @binding(1) var<uniform> brushParams: BrushParams;
      @group(0) @binding(2) var<uniform> uniforms: ComputeUniforms;
      @group(0) @binding(3) var<storage, read_write> instances: array<StrokeInstance>;

      // Seeded Random Number Generator (Mulberry32)
      fn seededRandom(state: ptr<function, u32>) -> f32 {
        *state = *state + 0x6D2B79F5u;
        var t = (*state ^ (*state >> 15u)) * (*state | 1u);
        t = t ^ (t + (t ^ (t >> 7u)) * (t | 61u));
        let result = t ^ (t >> 14u);
        return f32(result) / 4294967296.0;
      }

      fn calculatePressureInfluence(pressure: f32, influence: f32, minValue: f32) -> f32 {
        let clampedPressure = clamp(pressure, 0.0, 1.0);
        let pressureEffect = clampedPressure * influence + (1.0 - influence);
        return max(pressureEffect, minValue);
      }

      fn calculateTiltInfluence(tiltX: f32, tiltY: f32, influence: f32) -> f32 {
        let tiltMagnitude = sqrt(tiltX * tiltX + tiltY * tiltY);
        let tiltEffect = 1.0 + tiltMagnitude * influence;
        return clamp(tiltEffect, 0.1, 2.0);
      }

      fn calculateVelocityInfluence(velocity: f32, influence: f32, minValue: f32) -> f32 {
        let normalizedVelocity = clamp(velocity / 1000.0, 0.0, 1.0);
        let velocityEffect = 1.0 - normalizedVelocity * influence;
        return max(velocityEffect, minValue);
      }

      fn calculateInOutScale(progress: f32, totalLength: f32, inOutInfluence: f32, inOutLength: f32) -> f32 {
        if (inOutLength == 0.0) {
          return 1.0;
        }

        let inOutLengthNormalized = inOutLength / totalLength;

        if (progress <= inOutLengthNormalized) {
          return inOutInfluence + (1.0 - inOutInfluence) * (progress / inOutLengthNormalized);
        } else if (progress >= 1.0 - inOutLengthNormalized) {
          let fadeProgress = (1.0 - progress) / inOutLengthNormalized;
          return inOutInfluence + (1.0 - inOutInfluence) * fadeProgress;
        } else {
          return 1.0;
        }
      }

      fn interpolatePathPoint(segmentIndex: u32, t: f32) -> PathPoint {
        let numPoints = arrayLength(&pathPoints);
        if (segmentIndex >= numPoints - 1u) {
          return pathPoints[numPoints - 1u];
        }

        let p1 = pathPoints[segmentIndex];
        let p2 = pathPoints[segmentIndex + 1u];

        var interpolated: PathPoint;
        interpolated.x = p1.x + (p2.x - p1.x) * t;
        interpolated.y = p1.y + (p2.y - p1.y) * t;
        interpolated.pressure = p1.pressure + (p2.pressure - p1.pressure) * t;
        interpolated.tiltX = p1.tiltX + (p2.tiltX - p1.tiltX) * t;
        interpolated.tiltY = p1.tiltY + (p2.tiltY - p1.tiltY) * t;
        interpolated.velocity = p1.velocity + (p2.velocity - p1.velocity) * t;

        return interpolated;
      }

      @compute @workgroup_size(64)
      fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let instanceIndex = global_id.x;
        let maxInstances = arrayLength(&instances);

        if (instanceIndex >= maxInstances) {
          return;
        }

        let numPoints = arrayLength(&pathPoints);
        if (numPoints < 2u) {
          return;
        }

        // 実際のインスタンス数を計算（CPUと同じロジック）
        let actualInstanceCount = min(u32(ceil(uniforms.totalLength / uniforms.baseSpacing)), maxInstances);
        if (instanceIndex >= actualInstanceCount) {
          // 無効なインスタンスは初期化して処理終了
          instances[instanceIndex].positionX = 0.0;
          instances[instanceIndex].positionY = 0.0;
          instances[instanceIndex].size = 0.0;
          instances[instanceIndex].rotation = 0.0;
          instances[instanceIndex].opacity = 0.0;
          instances[instanceIndex].scale = 0.0;
          return;
        }

        let numSegments = numPoints - 1u;

        // 正確なprogress計算（0.0〜1.0の範囲に制限）
        // actualInstanceCount - 1で割ることで、最後のインスタンスがprogress=1.0になる
        let progress = clamp(f32(instanceIndex) / f32(max(actualInstanceCount - 1u, 1u)), 0.0, 1.0);

        // Find segment based on progress
        let segmentProgress = progress * f32(numSegments);
        let segmentIndex = u32(floor(segmentProgress));
        let t = segmentProgress - floor(segmentProgress);

        // Clamp segment index to valid range
        let clampedSegmentIndex = min(segmentIndex, numSegments - 1u);

        // Interpolate path point data
        let pointData = interpolatePathPoint(clampedSegmentIndex, t);

        // Calculate position and rotation
        let p1 = pathPoints[clampedSegmentIndex];
        let p2 = pathPoints[min(clampedSegmentIndex + 1u, numPoints - 1u)];
        let dx = p2.x - p1.x;
        let dy = p2.y - p1.y;
        let rotation = atan2(dy, dx);

        // Initialize random state
        var randomState = uniforms.seed + instanceIndex;

        // Calculate various effects (totalLengthはCPU側から渡されたuniforms.totalLengthを使用)
        let inOutScale = calculateInOutScale(progress, uniforms.totalLength, brushParams.inOutInfluence, brushParams.inOutLength);
        let randomScale = 1.0 + (seededRandom(&randomState) - 0.5) * brushParams.randomScale;
        let randomRotation = (seededRandom(&randomState) - 0.5) * brushParams.randomRotation * 3.14159;

        let pressureSizeScale = calculatePressureInfluence(pointData.pressure, brushParams.pressureSizeInfluence, brushParams.minSizeRatio);
        let pressureOpacityScale = calculatePressureInfluence(pointData.pressure, brushParams.pressureOpacityInfluence, brushParams.minOpacity);
        let tiltScale = calculateTiltInfluence(pointData.tiltX, pointData.tiltY, brushParams.tiltInfluence);
        let velocitySizeScale = calculateVelocityInfluence(pointData.velocity, brushParams.velocitySizeInfluence, brushParams.minSizeRatio);
        let velocityOpacityScale = calculateVelocityInfluence(pointData.velocity, brushParams.velocityOpacityInfluence, brushParams.minOpacity);

        // Scattering (CPU版と同じロジック)
        let scatterX = (seededRandom(&randomState) - 0.5) * brushParams.scatterSpread;
        let scatterY = (seededRandom(&randomState) - 0.5) * brushParams.scatterSpread;

        // Final calculations
        let finalSizeScale = inOutScale * randomScale * pressureSizeScale * velocitySizeScale * tiltScale;
        let finalOpacity = max(pressureOpacityScale * velocityOpacityScale, brushParams.minOpacity);

        // Write instance data
        instances[instanceIndex].positionX = pointData.x + scatterX;
        instances[instanceIndex].positionY = pointData.y + scatterY;
        instances[instanceIndex].size = brushParams.strokeSize * finalSizeScale;
        instances[instanceIndex].rotation = rotation * brushParams.rotationAdjust + randomRotation;
        instances[instanceIndex].opacity = finalOpacity;
        instances[instanceIndex].scale = finalSizeScale;
      }
    `

    // 手動でCompute Shaderデータ定義を設定（webgpu-utilsの問題を回避）
    this.computeShaderDataDefinitions = null

    const computeShaderModule = this.device.createShaderModule({
      label: 'StrokeInstanceComputeShader',
      code: computeShaderCode,
    })

    this.computePipeline = this.device.createComputePipeline({
      label: 'StrokeInstanceComputePipeline',
      layout: 'auto',
      compute: {
        module: computeShaderModule,
        entryPoint: 'main',
      },
    })

    this.computeBindGroupLayout =
      this.computePipeline?.getBindGroupLayout(0) || null
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

  private createComputeBuffers() {
    // パスデータ用ストレージバッファ（最大10000ポイント）
    const pathPointSize = 8 * 4 // PathPoint構造体のサイズ（8個のf32）
    this.pathDataBuffer = this.device.createBuffer({
      label: 'PathDataBuffer',
      size: this.maxPathPoints * pathPointSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })

    // ブラシパラメータ用ユニフォームバッファ
    const brushParamsSize = 16 * 4 // BrushParams構造体のサイズ（16個のf32）
    this.brushParamsBuffer = this.device.createBuffer({
      label: 'BrushParamsBuffer',
      size: brushParamsSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    // インスタンス出力用ストレージバッファ
    const instanceSize = 6 * 4 // StrokeInstance構造体のサイズ（6個のf32）
    this.instanceOutputBuffer = this.device.createBuffer({
      label: 'InstanceOutputBuffer',
      size: this.maxInstances * instanceSize,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.VERTEX |
        GPUBufferUsage.COPY_DST,
    })

    // Compute用ユニフォームバッファ
    const computeUniformSize = 4 * 4 // ComputeUniforms構造体のサイズ（4個のu32/f32）
    this.computeUniformBuffer = this.device.createBuffer({
      label: 'ComputeUniformBuffer',
      size: computeUniformSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
  }

  async loadBrushTexture(textureName: string): Promise<void> {
    if (this.textureCache.has(textureName)) {
      this.currentTexture = this.textureCache.get(textureName)!
      return
    }
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
      mips: false,
      flipY: false, // ブラシテクスチャでは反転不要
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    })

    // テクスチャのピクセルデータを分析
    try {
      const img = new Image()
      img.src = dataUrl
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
      })

      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)

      const imageData = ctx.getImageData(0, 0, img.width, img.height)
      const pixels = imageData.data

      // ピクセル統計を計算（より詳細な分析）
      let blackPixels = 0
      let whitePixels = 0
      let transparentPixels = 0
      let grayPixels = 0
      let totalAlpha = 0
      let maxAlpha = 0
      let minAlpha = 255
      let totalGrayValue = 0
      const grayValueCounts = new Array(256).fill(0)

      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i]
        const g = pixels[i + 1]
        const b = pixels[i + 2]
        const a = pixels[i + 3]

        totalAlpha += a
        maxAlpha = Math.max(maxAlpha, a)
        minAlpha = Math.min(minAlpha, a)

        // グレースケール値を計算
        const grayValue = Math.round((r + g + b) / 3)
        totalGrayValue += grayValue
        grayValueCounts[grayValue]++

        if (a === 0) transparentPixels++
        else if (r === 0 && g === 0 && b === 0) blackPixels++
        else if (r === 255 && g === 255 && b === 255) whitePixels++
        else grayPixels++
      }

      const totalPixels = pixels.length / 4
      const avgAlpha = totalAlpha / totalPixels
      const avgGrayValue = totalGrayValue / totalPixels

      // グレースケール値の分布を抽出（上位10位）
      const grayDistribution = grayValueCounts
        .map((count, value) => ({ value, count }))
        .filter((item) => item.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      // テクスチャピクセル分析結果をdebugStateに保存
      debugState.stroke.texturePixelAnalysis = {
        debugToken: `texture-pixels-v1-${crypto.randomUUID()}`,
        timestamp: new Date().toISOString(),
        action: 'texture_pixel_analysis',
        textureName,
        dimensions: {
          width: img.width,
          height: img.height,
          totalPixels,
        },
        pixelStats: {
          blackPixels,
          whitePixels,
          grayPixels,
          transparentPixels,
          blackPercentage: ((blackPixels / totalPixels) * 100).toFixed(2),
          whitePercentage: ((whitePixels / totalPixels) * 100).toFixed(2),
          grayPercentage: ((grayPixels / totalPixels) * 100).toFixed(2),
          transparentPercentage: (
            (transparentPixels / totalPixels) *
            100
          ).toFixed(2),
        },
        grayAnalysis: {
          averageGrayValue: avgGrayValue.toFixed(2),
          grayDistribution,
        },
        alphaStats: {
          min: minAlpha,
          max: maxAlpha,
          average: avgAlpha.toFixed(2),
        },
      }
    } catch (_error) {
      // ピクセル分析エラーは無視
    }

    this.textureCache.set(textureName, texture)
    this.currentTexture = texture
  }

  private async generateInstancesOnGPU(
    path: VectorPath,
    strokeSize: number,
    brushSettings: BrushSettings,
    seed?: number,
    artObjectId?: string,
  ): Promise<{ instanceBuffer: GPUBuffer; instanceCount: number }> {
    const startTime = performance.now()

    if (!this.computePipeline || !this.computeBindGroupLayout) {
      throw new Error('Compute pipeline not initialized')
    }

    if (path.points.length === 0) {
      throw new Error('Path has no points')
    }

    // パス点数を制限（安全性向上）
    const maxPathPoints = Math.min(path.points.length, this.maxPathPoints)

    // バッファサイズ確認
    const requiredSize = maxPathPoints * 8 * 4 // 8 floats * 4 bytes per float
    const availableSize = this.maxPathPoints * 8 * 4

    if (requiredSize > availableSize) {
      throw new Error(
        `Path data too large: required ${requiredSize} bytes, available ${availableSize} bytes`,
      )
    }

    // パスデータをStorage Bufferに書き込み
    const pathDataArray = new Float32Array(maxPathPoints * 8)
    for (let i = 0; i < maxPathPoints; i++) {
      const point = path.points[i]
      const offset = i * 8
      pathDataArray[offset + 0] = point.x
      pathDataArray[offset + 1] = point.y
      pathDataArray[offset + 2] = point.pressure || 1.0
      pathDataArray[offset + 3] = point.tilt?.x || 0.0
      pathDataArray[offset + 4] = point.tilt?.y || 0.0
      pathDataArray[offset + 5] = 0.0 // velocity (未対応)
      pathDataArray[offset + 6] = 0.0 // padding
      pathDataArray[offset + 7] = 0.0 // padding
    }

    // バッファ書き込み前のサイズ確認
    if (pathDataArray.byteLength > availableSize) {
      throw new Error(
        `PathDataArray too large: ${pathDataArray.byteLength} bytes, buffer size: ${availableSize} bytes`,
      )
    }

    this.device.queue.writeBuffer(this.pathDataBuffer!, 0, pathDataArray)

    // ブラシパラメータをUniform Bufferに書き込み
    const brushParamsData = new Float32Array([
      strokeSize,
      brushSettings.randomScale,
      brushSettings.randomRotation,
      brushSettings.rotationAdjust,
      brushSettings.scatterConfig?.spread || 0.5,
      brushSettings.scatterConfig?.sizeVariation || 0.2,
      brushSettings.scatterConfig?.opacityVariation || 0.1,
      brushSettings.inOutInfluence,
      brushSettings.inOutLength,
      brushSettings.pressureSizeInfluence || 0.8,
      brushSettings.pressureOpacityInfluence || 0.6,
      brushSettings.tiltInfluence || 0.3,
      brushSettings.velocitySizeInfluence || 0.4,
      brushSettings.velocityOpacityInfluence || 0.2,
      brushSettings.minSizeRatio || 0.1,
      brushSettings.minOpacity || 0.1,
    ])

    // ブラシパラメータバッファサイズ確認
    const brushParamsBufferSize = 16 * 4 // 16 floats * 4 bytes
    if (brushParamsData.byteLength > brushParamsBufferSize) {
      throw new Error(
        `BrushParams data too large: ${brushParamsData.byteLength} bytes, buffer size: ${brushParamsBufferSize} bytes`,
      )
    }

    this.device.queue.writeBuffer(this.brushParamsBuffer!, 0, brushParamsData)

    // パス長を計算
    let totalLength = 0
    for (let i = 0; i < maxPathPoints - 1; i++) {
      const p1 = path.points[i]
      const p2 = path.points[i + 1]
      const dx = p2.x - p1.x
      const dy = p2.y - p1.y
      totalLength += Math.sqrt(dx * dx + dy * dy)
    }

    // インスタンス数を計算（CPU版と同じロジック）
    // baseSpacingを適切な密度に設定（めちゃくちゃ密集させる）
    const baseSpacing = Math.max(strokeSize * 0.005, 0.05)
    const requestedInstances = Math.ceil(totalLength / baseSpacing)
    const instanceCount = Math.min(requestedInstances, this.maxInstances)

    // オーバーフローした場合は、実際に使用する長さを計算
    let effectiveTotalLength = totalLength
    if (requestedInstances > this.maxInstances) {
      // maxInstancesで表現できる最大長に制限
      effectiveTotalLength = this.maxInstances * baseSpacing
    }

    // デバッグ情報を記録
    debugState.stroke.instanceBuffer = {
      maxInstances: this.maxInstances,
      requestedInstances,
      actualInstances: instanceCount,
      overflow: requestedInstances > this.maxInstances,
      lastOverflowAt:
        requestedInstances > this.maxInstances ? Date.now() : null,
      totalLength,
      baseSpacing,
      overflowDetails:
        requestedInstances > this.maxInstances
          ? {
              totalRequested: requestedInstances,
              capped: instanceCount,
              overflowAmount: requestedInstances - this.maxInstances,
              timestamp: Date.now(),
            }
          : null,
    }

    // ストロークごとに新しいインスタンスバッファを作成
    const instanceSize = 6 * 4 // StrokeInstance構造体のサイズ（6個のf32）
    const strokeInstanceBuffer = this.device.createBuffer({
      label: `StrokeInstanceBuffer-${artObjectId || 'temp'}`,
      size: instanceCount * instanceSize,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.VERTEX |
        GPUBufferUsage.COPY_DST,
    })

    // バッファを0で初期化（前回のデータが残らないように）
    const zeroData = new Float32Array(instanceCount * 6)
    this.device.queue.writeBuffer(strokeInstanceBuffer, 0, zeroData)

    // Compute用ユニフォームデータを設定
    const computeUniformData = new Uint32Array(4)
    computeUniformData[0] = maxPathPoints // numPathPoints
    computeUniformData[1] = seed || Math.floor(Math.random() * 1000000) // seed
    // baseSpacingとtotalLengthをFloat32として扱う
    const computeUniformFloatView = new Float32Array(computeUniformData.buffer)
    computeUniformFloatView[2] = baseSpacing
    computeUniformFloatView[3] = effectiveTotalLength // オーバーフロー時は制限された長さを使用

    // Computeユニフォームバッファサイズ確認
    const computeUniformBufferSize = 4 * 4 // 4 u32/f32 * 4 bytes
    if (computeUniformData.byteLength > computeUniformBufferSize) {
      throw new Error(
        `ComputeUniforms data too large: ${computeUniformData.byteLength} bytes, buffer size: ${computeUniformBufferSize} bytes`,
      )
    }

    this.device.queue.writeBuffer(
      this.computeUniformBuffer!,
      0,
      computeUniformData,
    )

    // バインドグループを作成
    const computeBindGroup = this.device.createBindGroup({
      label: 'ComputeBindGroup',
      layout: this.computeBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.pathDataBuffer! } },
        { binding: 1, resource: { buffer: this.brushParamsBuffer! } },
        { binding: 2, resource: { buffer: this.computeUniformBuffer! } },
        { binding: 3, resource: { buffer: strokeInstanceBuffer } },
      ],
    })

    // 独立したCompute Command Encoderを作成して実行
    const computeEncoder = this.device.createCommandEncoder({
      label: 'StrokeComputeEncoder',
    })

    // Compute Pass実行
    const computePass = computeEncoder.beginComputePass({
      label: 'StrokeInstanceGenerationPass',
    })

    computePass.setPipeline(this.computePipeline)
    computePass.setBindGroup(0, computeBindGroup)

    // ワークグループ数を計算（64スレッド/ワークグループ）
    // maxInstancesではなくinstanceCountベースで計算
    const workgroupCount = Math.ceil(instanceCount / 64)
    computePass.dispatchWorkgroups(workgroupCount)

    computePass.end()

    // Computeを即座に実行して完了させる
    this.device.queue.submit([computeEncoder.finish()])

    // デバッグ情報更新
    debugState.stroke.rendering.lastInstanceCount = instanceCount
    debugState.stroke.rendering.computeDuration = performance.now() - startTime

    return {
      instanceBuffer: strokeInstanceBuffer,
      instanceCount,
    }
  }

  async render(
    renderPass: GPURenderPassEncoder,
    path: VectorPath,
    appearance: StrokeAppearance,
    projectionMatrix: Float32Array,
    viewMatrix: Float32Array,
    canvasSize: { width: number; height: number },
    inputBounds: BoundingBox,
    artObjectId?: string,
    temporaryBrushSettings?: BrushSettings,
  ): Promise<{ buffers: GPUBuffer[]; bounds: BoundingBox }> {
    try {
      // StrokeRenderer.render呼び出し

      if (!this.renderPipeline || !this.bindGroupLayout) {
        throw new AppearanceError(
          'StrokeRenderer: renderPipeline not initialized',
        )
      }

      if (!this.isGPUComputeAvailable) {
        // GPU Compute不可
        throw new AppearanceError(
          'StrokeRenderer: GPU Compute Pipeline is not available',
        )
      }

      // widthプロパティの存在チェック
      if (
        appearance.params.width === undefined ||
        appearance.params.width === null
      ) {
        return { buffers: [], bounds: inputBounds }
      }

      const strokeWidth = appearance.params.width
      const strokeTexture = appearance.params.brushSettings?.texture || 'pencil'

      await this.loadBrushTexture(strokeTexture)

      if (!this.currentTexture) {
        return { buffers: [], bounds: inputBounds }
      }

      const effectiveBrushSettings =
        temporaryBrushSettings ||
        appearance.params.brushSettings ||
        this.brushSettings

      let seed: number | undefined
      if (
        artObjectId &&
        artObjectId !== 'temp-stroke' &&
        !artObjectId.startsWith('integration-stroke') &&
        !artObjectId.startsWith('test-path')
      ) {
        seed = hashStringToNumber(artObjectId)
      }

      // GPUインスタンス生成開始

      // GPU上でインスタンス生成（独立して実行）
      const computeStartTime = performance.now()
      const { instanceBuffer, instanceCount } =
        await this.generateInstancesOnGPU(
          path,
          strokeWidth,
          effectiveBrushSettings,
          seed,
          artObjectId,
        )

      debugState.stroke.rendering.computeDuration =
        performance.now() - computeStartTime
      debugState.stroke.rendering.lastInstanceCount = instanceCount

      // GPUインスタンス生成完了

      // webgpu-utilsでユニフォーム設定
      if (this.uniformsView && this.uniformBuffer) {
        const brushColor = [
          appearance.params.color?.r ?? 1.0,
          appearance.params.color?.g ?? 1.0,
          appearance.params.color?.b ?? 1.0,
          appearance.params.color?.a ?? 1.0,
        ]

        this.uniformsView.set({
          projectionMatrix: projectionMatrix,
          viewMatrix: viewMatrix,
          canvasSize: [canvasSize.width, canvasSize.height],
          brushColor: brushColor,
        })

        this.device.queue.writeBuffer(
          this.uniformBuffer,
          0,
          this.uniformsView.arrayBuffer,
        )
      }

      // テクスチャが存在するかチェック
      if (!this.currentTexture) {
        await this.loadBrushTexture(effectiveBrushSettings.texture)
      }

      if (!this.currentTexture) {
        throw new Error('Brush texture not loaded')
      }

      // バインドグループを作成
      const bindGroup = this.device.createBindGroup({
        label: 'StrokeBindGroup',
        layout: this.bindGroupLayout,
        entries: [
          { binding: 0, resource: this.currentTexture.createView() },
          { binding: 1, resource: this.sampler },
          { binding: 2, resource: { buffer: this.uniformBuffer! } },
        ],
      })

      // 頂点データ（クアッド） - テクスチャ座標のデバッグ
      const vertices = new Float32Array([
        // position  texCoord
        -0.5,
        -0.5,
        0.0,
        0.0, // 左下
        0.5,
        -0.5,
        1.0,
        0.0, // 右下
        -0.5,
        0.5,
        0.0,
        1.0, // 左上
        0.5,
        0.5,
        1.0,
        1.0, // 右上
      ])

      // テクスチャ座標のデバッグ情報をdebugStateに保存
      debugState.stroke.textureCoordinates = {
        debugToken: `texcoord-debug-v1-${crypto.randomUUID()}`,
        timestamp: new Date().toISOString(),
        action: 'texture_coordinates_analysis',
        vertexData: {
          vertexCount: vertices.length / 4,
          vertices: Array.from(vertices),
          texCoords: [
            [vertices[2], vertices[3]], // 左下
            [vertices[6], vertices[7]], // 右下
            [vertices[10], vertices[11]], // 左上
            [vertices[14], vertices[15]], // 右上
          ],
        },
        currentTexture: {
          width: this.currentTexture?.width || 0,
          height: this.currentTexture?.height || 0,
          format: this.currentTexture?.format || 'unknown',
        },
      }

      const indices = new Uint16Array([0, 1, 2, 1, 3, 2])

      // 手動でバッファを作成（webgpu-utilsの問題を回避）
      const positionBuffer = this.device.createBuffer({
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      })
      this.device.queue.writeBuffer(positionBuffer, 0, vertices)

      const indexBuffer = this.device.createBuffer({
        size: indices.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      })
      this.device.queue.writeBuffer(indexBuffer, 0, indices)

      // パイプライン情報を更新
      debugState.stroke.pipeline.lastVertexBufferSize = vertices.byteLength
      debugState.stroke.pipeline.lastIndexBufferSize = indices.byteLength
      debugState.stroke.pipeline.lastInstanceBufferSize =
        this.maxInstances * 6 * 4
      debugState.stroke.pipeline.lastUniformBufferSize =
        this.uniformsView?.arrayBuffer.byteLength || 0
      debugState.stroke.pipeline.lastBindGroupCreated = true
      debugState.stroke.pipeline.lastDrawIndexedCalls = 1

      // レンダリング実行
      renderPass.setPipeline(this.renderPipeline)
      renderPass.setBindGroup(0, bindGroup)
      renderPass.setVertexBuffer(0, positionBuffer)
      renderPass.setVertexBuffer(1, instanceBuffer)
      renderPass.setIndexBuffer(indexBuffer, 'uint16')
      // 実際に生成されたインスタンス数のみ描画
      const actualInstanceCount = Math.min(instanceCount, this.maxInstances)

      // パーティクルデバッグ情報を更新
      debugState.stroke.particleDebug.lastRenderCall = {
        timestamp: performance.now(),
        instanceCount,
        actualDrawnInstances: actualInstanceCount,
        hasCurrentStroke: path.points.length >= 2,
        currentStrokePointCount: path.points.length,
        bufferCleared: true, // クリア処理を追加したのでtrue
        vertexShaderFiltered: 0, // 後で更新
        fragmentShaderDiscarded: 0, // 後で更新
      }
      debugState.stroke.particleDebug.renderingStats.totalRenderCalls++

      renderPass.drawIndexed(6, actualInstanceCount)

      // レンダーパス実行完了

      // GPUストロークレンダリング完了

      // 成功時のデバッグ情報更新
      debugState.stroke.rendering.lastError = null
      debugState.stroke.rendering.lastErrorStack = null
      debugState.stroke.rendering.lastErrorLocation = null
      debugState.stroke.rendering.lastSuccessTime = performance.now()
      debugState.stroke.rendering.successCount++

      // ストロークごとに作成したインスタンスバッファも破棄対象に含める
      return {
        buffers: [positionBuffer, indexBuffer, instanceBuffer],
        bounds: inputBounds,
      }
    } catch (error) {
      const errorDetails = {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
        pathPointCount: path.points.length,
        artObjectId,
        strokeSize: appearance.params.width,
        canvasSize: `${canvasSize.width}x${canvasSize.height}`,
        isGPUComputeAvailable: this.isGPUComputeAvailable,
        hasRenderPipeline: !!this.renderPipeline,
        hasComputePipeline: !!this.computePipeline,
      }

      // StrokeRenderer.render失敗

      // デバッグ状態に詳細エラー情報を保存
      debugState.stroke.rendering.lastError = errorDetails.message
      debugState.stroke.rendering.lastErrorStack = errorDetails.stack || null
      debugState.stroke.rendering.lastErrorLocation = 'StrokeRenderer.render'
      debugState.stroke.rendering.failureCount++

      throw error
    }
  }

  protected getBounds(path: VectorPath, strokeWidth: number): BoundingBox {
    if (path.points.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 }
    }

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const point of path.points) {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    }

    const padding = strokeWidth / 2
    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    }
  }

  calculateBounds(
    path: any,
    appearance: any,
    _inputBounds: BoundingBox,
  ): BoundingBox {
    return this.getBounds(path, appearance.params?.width || 1)
  }

  destroy() {
    // バッファとリソースをクリーンアップ
    this.uniformBuffer?.destroy()
    this.instanceBuffer?.destroy()
    this.pathDataBuffer?.destroy()
    this.brushParamsBuffer?.destroy()
    this.instanceOutputBuffer?.destroy()
    this.computeUniformBuffer?.destroy()

    // テクスチャキャッシュをクリア
    for (const texture of this.textureCache.values()) {
      try {
        texture.destroy()
      } catch (_error) {
        // テクスチャの破棄エラーは無視
      }
    }
    this.textureCache.clear()
  }
}

// CPU-based stroke instance generation function for testing
export function createStrokeInstances(
  path: VectorPath,
  strokeSize: number,
  brushSettings: BrushSettings,
  seed?: number,
): StrokeInstance[] {
  if (path.points.length === 0) return []

  const instances: StrokeInstance[] = []

  // パス長計算
  let totalLength = 0
  const segmentLengths: number[] = []

  for (let i = 0; i < path.points.length - 1; i++) {
    const p1 = path.points[i]
    const p2 = path.points[i + 1]
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    const length = Math.sqrt(dx * dx + dy * dy)
    segmentLengths.push(length)
    totalLength += length
  }

  if (totalLength === 0) return instances

  // インスタンス間隔を計算
  // spacingをより適切な値に設定（ストロークサイズの0.1倍程度）
  const spacing = Math.max(strokeSize * 0.1, 1.0)
  const instanceCount = Math.ceil(totalLength / spacing)

  // シード値を使用した疑似乱数生成器
  let randomState = seed || Math.floor(Math.random() * 1000000)
  const seededRandom = () => {
    randomState = (randomState * 1664525 + 1013904223) % 4294967296
    return randomState / 4294967296
  }

  // インスタンス生成
  for (let i = 0; i < instanceCount; i++) {
    const targetLength = (i / instanceCount) * totalLength

    // セグメントとt値を計算
    let currentLength = 0
    let segmentIndex = 0

    for (let j = 0; j < segmentLengths.length; j++) {
      if (currentLength + segmentLengths[j] >= targetLength) {
        segmentIndex = j
        break
      }
      currentLength += segmentLengths[j]
    }

    if (segmentIndex >= path.points.length - 1) continue

    const remainingLength = targetLength - currentLength
    const t =
      segmentLengths[segmentIndex] > 0
        ? remainingLength / segmentLengths[segmentIndex]
        : 0

    // ポイント補間
    const p1 = path.points[segmentIndex]
    const p2 = path.points[segmentIndex + 1]

    const x = p1.x + (p2.x - p1.x) * t
    const y = p1.y + (p2.y - p1.y) * t
    const pressure =
      (p1.pressure || 1) + ((p2.pressure || 1) - (p1.pressure || 1)) * t

    // 回転計算
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    const rotation = Math.atan2(dy, dx)

    // エフェクト計算
    const progress = targetLength / totalLength
    const inOutScale = calculateInOutScale(
      progress,
      totalLength,
      brushSettings.inOutInfluence,
      brushSettings.inOutLength,
    )
    const randomScale = 1.0 + (seededRandom() - 0.5) * brushSettings.randomScale
    const pressureScale = Math.max(
      pressure * (brushSettings.pressureSizeInfluence || 0.8),
      brushSettings.minSizeRatio || 0.1,
    )

    // スキャッター
    const scatterX =
      (seededRandom() - 0.5) * (brushSettings.scatterConfig?.spread || 0.5)
    const scatterY =
      (seededRandom() - 0.5) * (brushSettings.scatterConfig?.spread || 0.5)

    instances.push({
      position: { x: x + scatterX, y: y + scatterY },
      size: strokeSize * inOutScale * randomScale * pressureScale,
      rotation:
        rotation * brushSettings.rotationAdjust +
        (seededRandom() - 0.5) * brushSettings.randomRotation,
      opacity: Math.max(
        pressure * (brushSettings.pressureOpacityInfluence || 0.6),
        brushSettings.minOpacity || 0.1,
      ),
      scale: inOutScale * randomScale * pressureScale,
    })
  }

  return instances
}

// Helper functions
function calculateInOutScale(
  progress: number,
  totalLength: number,
  inOutInfluence: number,
  inOutLength: number,
): number {
  if (inOutLength === 0) return 1.0

  const inOutLengthNormalized = inOutLength / totalLength

  if (progress <= inOutLengthNormalized) {
    return (
      inOutInfluence +
      (1.0 - inOutInfluence) * (progress / inOutLengthNormalized)
    )
  } else if (progress >= 1.0 - inOutLengthNormalized) {
    const fadeProgress = (1.0 - progress) / inOutLengthNormalized
    return inOutInfluence + (1.0 - inOutInfluence) * fadeProgress
  } else {
    return 1.0
  }
}

function hashStringToNumber(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // 32bit整数に変換
  }
  return Math.abs(hash)
}
