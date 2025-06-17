import { RGBAColor, BlendMode } from '../../document/types'
import { VectorPath } from '../../document/path'
import { FillAppearance, isFillAppearance } from '../../document/appearance'
import {
  makeShaderDataDefinitions,
  makeStructuredView,
  createBuffersAndAttributesFromArrays,
} from 'webgpu-utils'

/**
 * パスからポリゴンへの三角分割を行う関数
 */
export async function triangulatePolygon(
  path: VectorPath,
  appearance: FillAppearance,
): Promise<Float32Array> {
  const points = path.points
  if (points.length < 3) {
    return new Float32Array(0)
  }

  // 重複点を除去（閉じたポリゴンで最初と最後が同じ場合）
  let uniquePoints = points
  if (points.length > 0) {
    const first = points[0]
    const last = points[points.length - 1]
    if (first.x === last.x && first.y === last.y) {
      uniquePoints = points.slice(0, -1)
    }
  }

  // 修正後の点数チェック
  if (uniquePoints.length < 3) {
    return new Float32Array(0)
  }

  // 簡単なファン三角分割を使用
  const triangles: number[] = []
  const color = appearance.params.color || { r: 0, g: 0, b: 0, a: 1 }
  const opacity = appearance.params.opacity || 1

  // 色をRGBA配列に変換
  const rgba = [color.r, color.g, color.b, color.a * opacity]

  // 最初の点を中心とした三角形ファンを作成
  const center = uniquePoints[0]
  for (let i = 1; i < uniquePoints.length - 1; i++) {
    const p1 = uniquePoints[i]
    const p2 = uniquePoints[i + 1]

    // 三角形の3つの頂点を追加
    // 中心点
    triangles.push(center.x, center.y, ...rgba)
    // 点1
    triangles.push(p1.x, p1.y, ...rgba)
    // 点2
    triangles.push(p2.x, p2.y, ...rgba)
  }

  const triangleCount = uniquePoints.length - 2
  const vertexCount = triangleCount * 3

  return new Float32Array(triangles)
}

/**
 * Fill描画用のレンダラー
 * WebGPUを使用してfill appearanceを描画
 * webgpu-utilsを使用して実装を簡素化
 */
export class FillRenderer {
  private device: GPUDevice
  private renderPipeline: GPURenderPipeline | null = null
  private uniformValues: any = null
  private uniformBuffer: GPUBuffer | null = null
  private bindGroup: GPUBindGroup | null = null

  // webgpu-utilsで自動生成されるレイアウト情報
  private bufferLayouts: GPUVertexBufferLayout[] = []
  private bindGroupLayout: GPUBindGroupLayout | null = null

  constructor(device: GPUDevice) {
    this.device = device
  }

  /**
   * レンダラーを初期化
   */
  async initialize(): Promise<boolean> {
    try {
      await this.createShaders()
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * シェーダーとレンダーパイプラインを作成
   * webgpu-utilsを使用して自動レイアウト生成
   */
  private async createShaders(): Promise<void> {
    try {
      // 塗りつぶし用のシェーダーコード（webgpu-utils対応）
      const shaderCode = `
        struct FillUniforms {
          projectionMatrix: mat4x4<f32>,
          viewMatrix: mat4x4<f32>,
          canvasSize: vec2<f32>,
        }
        @group(0) @binding(0) var<uniform> uniforms: FillUniforms;

        struct VertexInput {
          @location(0) position: vec2<f32>,
          @location(1) color: vec4<f32>,
        }

        struct VertexOutput {
          @builtin(position) position: vec4<f32>,
          @location(0) color: vec4<f32>,
        }

        @vertex
        fn vs_main(input: VertexInput) -> VertexOutput {
          var output: VertexOutput;

          // ワールド座標を4D同次座標に拡張
          let worldPos = vec4<f32>(input.position, 0.0, 1.0);
          
          // ビュー変換を適用
          let viewPos = uniforms.viewMatrix * worldPos;
          
          // プロジェクション変換を適用
          output.position = uniforms.projectionMatrix * viewPos;
          output.color = input.color;
          return output;
        }

        @fragment
        fn fs_main(@location(0) color: vec4<f32>) -> @location(0) vec4<f32> {
          return color;
        }
      `

      const defs = makeShaderDataDefinitions(shaderCode)

      this.uniformValues = makeStructuredView(defs.uniforms.uniforms)

      // ユニフォームバッファーを正しいサイズで作成
      this.uniformBuffer = this.device.createBuffer({
        label: 'FillUniformBuffer',
        size: this.uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      })

      const shaderModule = this.device.createShaderModule({
        label: 'FillShaderModule',
        code: shaderCode,
      })

      // バインドグループレイアウトを作成
      this.bindGroupLayout = this.device.createBindGroupLayout({
        label: 'FillBindGroupLayout',
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.VERTEX,
            buffer: { type: 'uniform' },
          },
        ],
      })

      // バインドグループを作成
      this.bindGroup = this.device.createBindGroup({
        label: 'FillBindGroup',
        layout: this.bindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: this.uniformBuffer },
          },
        ],
      })

      // webgpu-utilsでサンプルのバッファレイアウトを取得
      // 明示的に成分数を指定してダミーデータで作成
      const sampleBufferInfo = createBuffersAndAttributesFromArrays(
        this.device,
        {
          position: { numComponents: 2, data: [0, 0] }, // 2成分のposition
          color: { numComponents: 4, data: [1, 0, 0, 1] }, // 4成分のcolor
        },
      )

      this.bufferLayouts = sampleBufferInfo.bufferLayouts

      // サンプルバッファは破棄
      sampleBufferInfo.buffers.forEach((buffer) => buffer.destroy())

      // レンダーパイプラインを作成
      this.renderPipeline = this.device.createRenderPipeline({
        label: 'FillRenderPipeline',
        layout: this.device.createPipelineLayout({
          bindGroupLayouts: [this.bindGroupLayout],
        }),
        vertex: {
          module: shaderModule,
          entryPoint: 'vs_main',
          buffers: this.bufferLayouts,
        },
        fragment: {
          module: shaderModule,
          entryPoint: 'fs_main',
          targets: [
            {
              format: navigator.gpu.getPreferredCanvasFormat(),
            },
          ],
        },
        primitive: {
          topology: 'triangle-list',
        },
      })
    } catch (error) {
      throw error
    }
  }

  /**
   * パスをfill appearanceで描画
   * @returns 破棄が必要なバッファの配列
   */
  async renderPath(
    renderPass: GPURenderPassEncoder,
    path: VectorPath,
    appearance: FillAppearance,
    projectionMatrix: Float32Array,
    viewMatrix: Float32Array,
    canvasSize: { width: number; height: number },
  ): Promise<GPUBuffer[]> {
    if (!this.renderPipeline || !this.uniformBuffer || !this.bindGroup) {
      return []
    }

    // パスが閉じていない場合は塗りつぶししない
    if (!path.closed) {
      return []
    }

    // パスの点が3点未満の場合は描画しない
    if (path.points.length < 3) {
      return []
    }

    // ユニフォームデータを更新（webgpu-utilsの構造化ビューを使用）
    this.uniformValues.set({
      projectionMatrix: projectionMatrix,
      viewMatrix: viewMatrix,
      canvasSize: [canvasSize.width, canvasSize.height],
    })

    this.device.queue.writeBuffer(
      this.uniformBuffer,
      0,
      this.uniformValues.arrayBuffer,
    )

    // パスを三角形に分割（ファン三角分割）

    const triangles = await triangulatePolygon(path, appearance)

    if (triangles.length === 0) {
      return []
    }

    const totalVertexCount = triangles.length / 6

    // webgpu-utilsを使って頂点バッファーを自動作成
    try {
      // 手動でインターリーブバッファを作成（webgpu-utilsの制限回避）
      const vertexCount = triangles.length / 6

      // バッファを手動作成
      const vertexBuffer = this.device.createBuffer({
        label: 'FillVertexBuffer',
        size: triangles.length * 4, // Float32Array
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      })

      // データを転送
      this.device.queue.writeBuffer(vertexBuffer, 0, triangles)

      // 既存のレンダーパスで描画
      renderPass.setPipeline(this.renderPipeline)

      renderPass.setBindGroup(0, this.bindGroup)

      // 手動作成したバッファを設定
      renderPass.setVertexBuffer(0, vertexBuffer)

      // 頂点数で描画

      renderPass.draw(vertexCount)

      // 手動作成したバッファを返して、呼び出し元で破棄管理
      return [vertexBuffer]
    } catch (error) {
      throw error
    }
  }

  /**
   * リソースを解放
   */
  dispose(): void {
    this.uniformBuffer?.destroy()
    this.uniformBuffer = null
    this.renderPipeline = null
    this.bindGroup = null
    this.bindGroupLayout = null
  }
}
