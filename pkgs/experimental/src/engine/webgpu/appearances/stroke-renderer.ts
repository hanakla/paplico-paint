import { VectorPath, Color, Vector2 } from '../../state'
import { TextureLoader } from '../texture-loader'

export interface StrokeInstance {
  position: Vector2
  size: number
  rotation: number
  opacity: number
}

export class StrokeRenderer {
  private device: GPUDevice
  private textureLoader: TextureLoader
  private renderPipeline: GPURenderPipeline | null = null
  private bindGroupLayout: GPUBindGroupLayout | null = null

  // テクスチャとサンプラー
  private currentTexture: GPUTexture | null = null
  private sampler: GPUSampler

  // インスタンス用バッファ
  private instanceBuffer: GPUBuffer | null = null
  private maxInstances = 10000

  constructor(device: GPUDevice) {
    this.device = device
    this.textureLoader = new TextureLoader(device)

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
  }

  private async createRenderPipeline() {
    const vertexShaderCode = `
      struct VertexInput {
        @location(0) position: vec2<f32>,
        @location(1) texCoord: vec2<f32>,
      }

      struct InstanceInput {
        @location(2) instancePosition: vec2<f32>,
        @location(3) instanceSize: f32,
        @location(4) instanceRotation: f32,
        @location(5) instanceOpacity: f32,
      }

      struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) texCoord: vec2<f32>,
        @location(1) opacity: f32,
      }

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

        // スケール and 位置を適用
        let worldPos = rotatedPos * instance.instanceSize + instance.instancePosition;

        output.position = vec4<f32>(worldPos, 0.0, 1.0);
        output.texCoord = vertex.texCoord;
        output.opacity = instance.instanceOpacity;

        return output;
      }
    `

    const fragmentShaderCode = `
      @group(0) @binding(0) var brushTexture: texture_2d<f32>;
      @group(0) @binding(1) var brushSampler: sampler;
      @group(0) @binding(2) var<uniform> brushColor: vec4<f32>;

      struct FragmentInput {
        @location(0) texCoord: vec2<f32>,
        @location(1) opacity: f32,
      }

      @fragment
      fn fs_main(input: FragmentInput) -> @location(0) vec4<f32> {
        let texSample = textureSample(brushTexture, brushSampler, input.texCoord);

        // グレースケール値をアルファとして使用（黒=透明、白=不透明）
        let alpha = texSample.r * brushColor.a * input.opacity;

        return vec4<f32>(brushColor.rgb, alpha);
      }
    `

    const vertexShader = this.device.createShaderModule({
      label: 'BrushVertexShader',
      code: vertexShaderCode,
    })

    const fragmentShader = this.device.createShaderModule({
      label: 'BrushFragmentShader',
      code: fragmentShaderCode,
    })

    // バインドグループレイアウトを作成
    this.bindGroupLayout = this.device.createBindGroupLayout({
      label: 'BrushBindGroupLayout',
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
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
      ],
    })

    const pipelineLayout = this.device.createPipelineLayout({
      label: 'BrushPipelineLayout',
      bindGroupLayouts: [this.bindGroupLayout],
    })

    this.renderPipeline = this.device.createRenderPipeline({
      label: 'BrushRenderPipeline',
      layout: pipelineLayout,
      vertex: {
        module: vertexShader,
        entryPoint: 'vs_main',
        buffers: [
          {
            // 頂点バッファ (quad)
            arrayStride: 4 * 4, // vec2 position + vec2 texCoord
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' }, // position
              { shaderLocation: 1, offset: 8, format: 'float32x2' }, // texCoord
            ],
          },
          {
            // インスタンスバッファ
            arrayStride: 5 * 4, // vec2 position + float size + float rotation + float opacity
            stepMode: 'instance',
            attributes: [
              { shaderLocation: 2, offset: 0, format: 'float32x2' }, // instancePosition
              { shaderLocation: 3, offset: 8, format: 'float32' }, // instanceSize
              { shaderLocation: 4, offset: 12, format: 'float32' }, // instanceRotation
              { shaderLocation: 5, offset: 16, format: 'float32' }, // instanceOpacity
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
    })
  }

  private createInstanceBuffer() {
    this.instanceBuffer = this.device.createBuffer({
      label: 'StrokeInstanceBuffer',
      size: this.maxInstances * 5 * 4, // 5 floats per instance
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    })
  }

  async loadBrushTexture(textureName: string): Promise<void> {
    const textureUrl = `/src/engine/assets/${textureName}`
    this.currentTexture = await this.textureLoader.loadTexture(textureUrl)
  }

  createStrokeInstancesFromPath(
    path: VectorPath,
    strokeSize: number,
  ): StrokeInstance[] {
    const instances: StrokeInstance[] = []

    if (path.points.length === 0) return instances

    // パス上にストロークインスタンスを配置
    const spacing = Math.max(strokeSize * 0.1, 1.0) // ストロークサイズに基づく間隔

    for (let i = 0; i < path.points.length - 1; i++) {
      const p1 = path.points[i]
      const p2 = path.points[i + 1]

      const dx = p2.x - p1.x
      const dy = p2.y - p1.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance === 0) continue

      const steps = Math.max(1, Math.floor(distance / spacing))
      const rotation = Math.atan2(dy, dx)

      for (let step = 0; step <= steps; step++) {
        const t = step / steps
        const x = p1.x + dx * t
        const y = p1.y + dy * t

        instances.push({
          position: { x, y },
          size: strokeSize * 0.01, // 正規化座標用にスケール調整
          rotation,
          opacity: 1.0,
        })
      }
    }

    // 最初の点にもインスタンスを追加
    if (path.points.length > 0) {
      instances.unshift({
        position: path.points[0],
        size: strokeSize * 0.01,
        rotation: 0,
        opacity: 1.0,
      })
    }

    return instances
  }

  async renderPath(
    renderPass: GPURenderPassEncoder,
    path: VectorPath,
    strokeSize: number,
    strokeTexture: string = 'pencil.png',
  ): Promise<GPUBuffer[]> {
    if (!this.renderPipeline || !this.bindGroupLayout || !this.instanceBuffer) {
      console.error('Stroke renderer not initialized')
      return []
    }

    // ストロークテクスチャをロード（キャッシュされる）
    await this.loadBrushTexture(strokeTexture)

    if (!this.currentTexture) {
      console.error('Failed to load stroke texture')
      return []
    }

    // ストロークインスタンスを生成
    const instances = this.createStrokeInstancesFromPath(path, strokeSize)

    if (instances.length === 0) return []

    // インスタンスデータを作成
    const instanceData = new Float32Array(instances.length * 5)
    for (let i = 0; i < instances.length; i++) {
      const instance = instances[i]
      const offset = i * 5
      instanceData[offset + 0] = instance.position.x
      instanceData[offset + 1] = instance.position.y
      instanceData[offset + 2] = instance.size
      instanceData[offset + 3] = instance.rotation
      instanceData[offset + 4] = instance.opacity
    }

    // インスタンスバッファを更新
    this.device.queue.writeBuffer(this.instanceBuffer, 0, instanceData)

    // ブラシカラー用のユニフォームバッファを作成
    const colorBuffer = this.device.createBuffer({
      label: 'BrushColorBuffer',
      size: 16, // vec4<f32>
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    const colorData = new Float32Array([
      path.color.r,
      path.color.g,
      path.color.b,
      path.color.a,
    ])
    this.device.queue.writeBuffer(colorBuffer, 0, colorData)

    // バインドグループを作成
    const bindGroup = this.device.createBindGroup({
      label: 'BrushBindGroup',
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: this.currentTexture.createView() },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: { buffer: colorBuffer } },
      ],
    })

    // クアッド（四角形）の頂点データ
    const quadVertices = new Float32Array([
      // position   texCoord
      -0.5,
      -0.5,
      0.0,
      1.0, // 左下
      0.5,
      -0.5,
      1.0,
      1.0, // 右下
      0.5,
      0.5,
      1.0,
      0.0, // 右上
      0.5,
      0.5,
      1.0,
      0.0, // 右上
      -0.5,
      0.5,
      0.0,
      0.0, // 左上
      -0.5,
      -0.5,
      0.0,
      1.0, // 左下
    ])

    const quadBuffer = this.device.createBuffer({
      label: 'BrushQuadBuffer',
      size: quadVertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    })
    this.device.queue.writeBuffer(quadBuffer, 0, quadVertices)

    // 描画
    renderPass.setPipeline(this.renderPipeline)
    renderPass.setBindGroup(0, bindGroup)
    renderPass.setVertexBuffer(0, quadBuffer)
    renderPass.setVertexBuffer(1, this.instanceBuffer)
    renderPass.draw(6, instances.length) // 6頂点でクアッド、インスタンス数だけ描画

    // バッファを返却（呼び出し元で破棄）
    return [quadBuffer, colorBuffer]
  }

  destroy() {
    this.instanceBuffer?.destroy()
    this.textureLoader.destroy()
  }
}
