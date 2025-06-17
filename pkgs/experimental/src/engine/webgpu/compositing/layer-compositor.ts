import { BoundingBox } from '../interfaces/IAppearanceProcessor'
import { OffscreenTexturePool } from './offscreen-texture-pool'
import { debugLogger } from '../../../utils/debug-logger'
import {
  makeShaderDataDefinitions,
  makeBindGroupLayoutDescriptors,
} from 'webgpu-utils'

/**
 * レイヤー合成システム
 * オフスクリーンテクスチャを使用してレイヤー透明度を正確に適用
 */
export class LayerCompositor {
  private device: GPUDevice
  private texturePool: OffscreenTexturePool
  private compositeRenderPipeline: GPURenderPipeline | null = null
  private quadVertexBuffer: GPUBuffer | null = null
  private sampler: GPUSampler | null = null
  private uniformBuffer: GPUBuffer | null = null // 再利用可能なユニフォームバッファ

  constructor(device: GPUDevice, texturePool: OffscreenTexturePool) {
    this.device = device
    this.texturePool = texturePool
  }

  /**
   * 初期化
   */
  async initialize(): Promise<void> {
    await this.createCompositeRenderPipeline()
    this.createQuadVertexBuffer()
    this.createSampler()
    this.createUniformBuffer()
  }

  /**
   * 再利用可能なユニフォームバッファを作成
   */
  private createUniformBuffer(): void {
    this.uniformBuffer = this.device.createBuffer({
      label: 'CompositeUniformBuffer',
      size: 256, // opacity(4) + transform(36) + projectionMatrix(64) + viewMatrix(64) + padding
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
  }

  /**
   * 合成用のレンダーパイプラインを作成
   */
  private async createCompositeRenderPipeline(): Promise<void> {
    const vertexShaderCode = `
      struct CompositeUniforms {
        opacity: f32,
        transform: mat3x3<f32>,
        projectionMatrix: mat4x4<f32>,
        viewMatrix: mat4x4<f32>,
      }
      @group(1) @binding(0) var<uniform> composite: CompositeUniforms;

      struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) texCoord: vec2<f32>,
      }

      @vertex
      fn vs_main(@location(0) position: vec2<f32>, @location(1) texCoord: vec2<f32>) -> VertexOutput {
        var output: VertexOutput;
        let worldPos = vec4<f32>(position, 0.0, 1.0);
        let viewPos = composite.viewMatrix * worldPos;
        output.position = composite.projectionMatrix * viewPos;
        output.texCoord = texCoord;
        return output;
      }
    `

    const fragmentShaderCode = `
      @group(0) @binding(0) var textureSampler: sampler;
      @group(0) @binding(1) var sourceTexture: texture_2d<f32>;
      struct CompositeUniforms {
        opacity: f32,
        transform: mat3x3<f32>,
        projectionMatrix: mat4x4<f32>,
        viewMatrix: mat4x4<f32>,
      }
      @group(1) @binding(0) var<uniform> composite: CompositeUniforms;
      @fragment
      fn fs_main(@location(0) texCoord: vec2<f32>) -> @location(0) vec4<f32> {
        var color = textureSample(sourceTexture, textureSampler, texCoord);
        color.a *= composite.opacity;
        return color;
      }
    `

    const vertexShader = this.device.createShaderModule({
      label: 'CompositeVertexShader',
      code: vertexShaderCode,
    })
    const fragmentShader = this.device.createShaderModule({
      label: 'CompositeFragmentShader',
      code: fragmentShaderCode,
    })

    const shaderCode = vertexShaderCode + '\n' + fragmentShaderCode
    const defs = makeShaderDataDefinitions(shaderCode)

    const pipelineDescriptor = {
      vertex: {
        module: vertexShader,
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 4 * 4, // position(2) + texCoord(2) = 4 floats
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' },
              { shaderLocation: 1, offset: 2 * 4, format: 'float32x2' },
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
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          },
        ],
      },
    }

    const bindGroupLayouts = makeBindGroupLayoutDescriptors(
      defs,
      pipelineDescriptor,
    )
    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [
        this.device.createBindGroupLayout(bindGroupLayouts[0]),
        this.device.createBindGroupLayout(bindGroupLayouts[1]),
      ],
    })

    this.compositeRenderPipeline = this.device.createRenderPipeline({
      label: 'CompositeRenderPipeline',
      layout: pipelineLayout,
      primitive: {
        topology: 'triangle-strip',
      },
      vertex: {
        module: vertexShader,
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 4 * 4, // position(2) + texCoord(2) = 4 floats
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' },
              { shaderLocation: 1, offset: 2 * 4, format: 'float32x2' },
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
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          },
        ],
      },
    })
  }

  /**
   * フルスクリーンクアッド用の頂点バッファを作成
   */
  private createQuadVertexBuffer(): void {
    // Triangle strip用の正しい頂点順序: 左下→左上→右下→右上
    const quadVertices = new Float32Array([
      // position(x,y), texCoord(u,v)
      -1.0,
      -1.0,
      0.0,
      1.0, // 左下
      -1.0,
      1.0,
      0.0,
      0.0, // 左上
      1.0,
      -1.0,
      1.0,
      1.0, // 右下
      1.0,
      1.0,
      1.0,
      0.0, // 右上
    ])

    this.quadVertexBuffer = this.device.createBuffer({
      label: 'CompositeQuadVertexBuffer',
      size: quadVertices.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    })

    if (this.quadVertexBuffer) {
      new Float32Array(this.quadVertexBuffer.getMappedRange()).set(quadVertices)
      this.quadVertexBuffer.unmap()
    }
  }

  /**
   * テクスチャサンプラーを作成
   */
  private createSampler(): void {
    this.sampler = this.device.createSampler({
      magFilter: 'nearest',
      minFilter: 'nearest',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    })
  }

  /**
   * レイヤーをオフスクリーンテクスチャに描画
   */
  async renderLayerToOffscreen(
    bounds: BoundingBox,
    renderFunction: (renderPass: GPURenderPassEncoder) => Promise<void>,
  ): Promise<GPUTexture> {
    const offscreenTexture = this.texturePool.acquireTextureForBounds(bounds)

    const commandEncoder = this.device.createCommandEncoder({
      label: 'LayerOffscreenRenderCommandEncoder',
    })

    const renderPass = commandEncoder.beginRenderPass({
      label: 'LayerOffscreenRenderPass',
      colorAttachments: [
        {
          view: offscreenTexture.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 }, // 透明でクリア
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    })

    // レイヤー内容を描画
    await renderFunction(renderPass)

    renderPass.end()
    this.device.queue.submit([commandEncoder.finish()])

    return offscreenTexture
  }

  /**
   * オフスクリーンテクスチャをメインキャンバスに合成
   */
  async compositeTextureToMain(
    mainRenderPass: GPURenderPassEncoder,
    sourceTexture: GPUTexture,
    bounds: BoundingBox,
    opacity: number,
    projectionMatrix?: Float32Array,
    viewMatrix?: Float32Array,
  ): Promise<void> {
    if (!this.compositeRenderPipeline || !this.sampler || !this.uniformBuffer) {
      throw new Error('LayerCompositor not initialized')
    }

    // 適切な座標変換を使用してクアッドを作成
    const positionedQuadBuffer = this.createPositionedQuadBuffer(
      bounds,
      projectionMatrix,
      viewMatrix,
    )

    // ユニフォームデータを更新
    const uniformData = new Float32Array(64) // 256 bytes / 4 = 64 floats

    // opacity (1 float)
    uniformData[0] = opacity

    // transform matrix (3x3 = 9 floats, パディングで12 floats)
    uniformData[4] = 1.0
    uniformData[5] = 0.0
    uniformData[6] = 0.0
    uniformData[7] = 0.0
    uniformData[8] = 0.0
    uniformData[9] = 1.0
    uniformData[10] = 0.0
    uniformData[11] = 0.0
    uniformData[12] = 0.0
    uniformData[13] = 0.0
    uniformData[14] = 1.0
    uniformData[15] = 0.0

    // projectionMatrix (16 floats)
    if (projectionMatrix) {
      for (let i = 0; i < 16; i++) {
        uniformData[16 + i] = projectionMatrix[i]
      }
    } else {
      // デフォルトの単位行列
      uniformData[16] = 1.0
      uniformData[17] = 0.0
      uniformData[18] = 0.0
      uniformData[19] = 0.0
      uniformData[20] = 0.0
      uniformData[21] = 1.0
      uniformData[22] = 0.0
      uniformData[23] = 0.0
      uniformData[24] = 0.0
      uniformData[25] = 0.0
      uniformData[26] = 1.0
      uniformData[27] = 0.0
      uniformData[28] = 0.0
      uniformData[29] = 0.0
      uniformData[30] = 0.0
      uniformData[31] = 1.0
    }

    // viewMatrix (16 floats)
    if (viewMatrix) {
      for (let i = 0; i < 16; i++) {
        uniformData[32 + i] = viewMatrix[i]
      }
    } else {
      // デフォルトの単位行列
      uniformData[32] = 1.0
      uniformData[33] = 0.0
      uniformData[34] = 0.0
      uniformData[35] = 0.0
      uniformData[36] = 0.0
      uniformData[37] = 1.0
      uniformData[38] = 0.0
      uniformData[39] = 0.0
      uniformData[40] = 0.0
      uniformData[41] = 0.0
      uniformData[42] = 1.0
      uniformData[43] = 0.0
      uniformData[44] = 0.0
      uniformData[45] = 0.0
      uniformData[46] = 0.0
      uniformData[47] = 1.0
    }

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData)

    // バインドグループを作成
    const bindGroup0 = this.device.createBindGroup({
      layout: this.compositeRenderPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: this.sampler,
        },
        {
          binding: 1,
          resource: sourceTexture.createView(),
        },
      ],
    })

    const bindGroup1 = this.device.createBindGroup({
      layout: this.compositeRenderPipeline.getBindGroupLayout(1),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.uniformBuffer,
          },
        },
      ],
    })

    // 描画
    mainRenderPass.setPipeline(this.compositeRenderPipeline)
    mainRenderPass.setBindGroup(0, bindGroup0)
    mainRenderPass.setBindGroup(1, bindGroup1)
    mainRenderPass.setVertexBuffer(0, positionedQuadBuffer)
    mainRenderPass.draw(4) // クアッド描画

    // 一時的なバッファを破棄
    setTimeout(() => {
      positionedQuadBuffer.destroy()
    }, 0)
  }

  /**
   * レイヤーのバウンディングボックスに応じた位置付きクアッドバッファを作成
   */
  private createPositionedQuadBuffer(
    bounds: BoundingBox,
    projectionMatrix?: Float32Array,
    viewMatrix?: Float32Array,
  ): GPUBuffer {
    // メインキャンバスの座標系でのクアッドの位置を計算
    const left = bounds.x
    const right = bounds.x + bounds.width
    const top = bounds.y
    const bottom = bounds.y + bounds.height

    // ワールド座標をそのまま使用（シェーダー側で変換）
    // Triangle strip用の正しい頂点順序: 左下→左上→右下→右上
    const quadVertices = new Float32Array([
      // position(x,y), texCoord(u,v)
      left,
      bottom,
      0.0,
      1.0, // 左下
      left,
      top,
      0.0,
      0.0, // 左上
      right,
      bottom,
      1.0,
      1.0, // 右下
      right,
      top,
      1.0,
      0.0, // 右上
    ])

    const buffer = this.device.createBuffer({
      label: 'PositionedCompositeQuadVertexBuffer',
      size: quadVertices.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    })

    if (buffer) {
      new Float32Array(buffer.getMappedRange()).set(quadVertices)
      buffer.unmap()
    }

    return buffer
  }

  /**
   * リソースを解放
   */
  destroy(): void {
    this.quadVertexBuffer?.destroy()
    this.quadVertexBuffer = null
    this.uniformBuffer?.destroy()
    this.uniformBuffer = null
    this.compositeRenderPipeline = null
    this.sampler = null
  }
}
