/**
 * 頂点編集ツールのWebGPUレンダラー
 * 頂点とベジエハンドルの描画を担当
 */

import type { Camera2D } from '../../camera/camera-2d'
import type { VertexEditTool } from '../../tools/vertex-edit-tool'
import type { PathVertex, BezierHandle, Vector2 } from '../../selection-types'
import type { IWebGPUUIComponent } from './IWebGPUUIComponent'
import { DocumentContext } from '../../document-manager'
import { makeStructuredView, makeShaderDataDefinitions } from 'webgpu-utils'

export class VertexEditRenderer implements IWebGPUUIComponent {
  public readonly name = 'VertexEditRenderer'
  public readonly layer = 'foreground'
  public readonly order = 100

  private device: GPUDevice
  private renderPipeline: GPURenderPipeline | null = null
  private uniformBuffer: GPUBuffer | null = null
  private bindGroup: GPUBindGroup | null = null
  private vertexEditTool: VertexEditTool | null = null
  private uniformValues: ReturnType<typeof makeStructuredView>['views'] | null =
    null
  private structuredView: ReturnType<typeof makeStructuredView> | null = null

  constructor(device: GPUDevice) {
    this.device = device
  }

  /**
   * 頂点編集ツールを設定
   */
  setVertexEditTool(tool: VertexEditTool): void {
    this.vertexEditTool = tool
  }

  getCoordinateSystem(): 'world' {
    return 'world'
  }

  getRenderLayer(): 'foreground' {
    return 'foreground'
  }

  async initialize(): Promise<void> {
    await this.createRenderPipeline()
    this.createUniformBuffer()
  }

  private async createRenderPipeline(): Promise<void> {
    const shaderModule = this.device.createShaderModule({
      label: 'VertexEditShader',
      code: `
        struct Uniforms {
          projectionMatrix: mat4x4<f32>,
          viewMatrix: mat4x4<f32>,
          canvasSize: vec2<f32>,
          time: f32,
          padding: f32,
        }

        struct VertexData {
          position: vec2<f32>,
          color: vec4<f32>,
          size: f32,
          vertexType: f32, // 0: vertex, 1: handle, 2: connection line
        }

        @group(0) @binding(0) var<uniform> uniforms: Uniforms;

        struct VertexOutput {
          @builtin(position) position: vec4<f32>,
          @location(0) color: vec4<f32>,
          @location(1) size: f32,
          @location(2) vertexType: f32,
          @location(3) localPos: vec2<f32>,
        }

        @vertex
        fn vs_main(
          @location(0) position: vec2<f32>,
          @location(1) color: vec4<f32>,
          @location(2) size: f32,
          @location(3) vertexType: f32,
          @builtin(vertex_index) vertexIndex: u32
        ) -> VertexOutput {
          var output: VertexOutput;
          
          // クアッド頂点オフセット
          var offsets = array<vec2<f32>, 6>(
            vec2<f32>(-1.0, -1.0),
            vec2<f32>( 1.0, -1.0),
            vec2<f32>(-1.0,  1.0),
            vec2<f32>( 1.0, -1.0),
            vec2<f32>( 1.0,  1.0),
            vec2<f32>(-1.0,  1.0)
          );
          
          let offset = offsets[vertexIndex % 6u];
          let localPos = offset * size;
          
          // ワールド座標から画面座標への変換
          let worldPos = vec4<f32>(position + localPos, 0.0, 1.0);
          let viewPos = uniforms.viewMatrix * worldPos;
          output.position = uniforms.projectionMatrix * viewPos;
          
          output.color = color;
          output.size = size;
          output.vertexType = vertexType;
          output.localPos = offset;
          
          return output;
        }

        @fragment
        fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
          let dist = length(input.localPos);
          
          if (input.vertexType < 0.5) {
            // 頂点（四角形）
            if (abs(input.localPos.x) > 0.8 || abs(input.localPos.y) > 0.8) {
              return input.color;
            } else {
              return vec4<f32>(1.0, 1.0, 1.0, input.color.a);
            }
          } else if (input.vertexType < 1.5) {
            // ハンドル（円形）
            if (dist > 1.0) {
              discard;
            }
            
            if (dist > 0.7) {
              return input.color;
            } else {
              return vec4<f32>(1.0, 1.0, 1.0, input.color.a);
            }
          } else {
            // 接続線
            if (abs(input.localPos.y) > 0.1) {
              discard;
            }
            return input.color;
          }
        }
      `,
    })

    this.renderPipeline = this.device.createRenderPipeline({
      label: 'VertexEditRenderPipeline',
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 32, // vec2 + vec4 + f32 + f32 = 8 + 16 + 4 + 4 = 32 bytes
            attributes: [
              { format: 'float32x2', offset: 0, shaderLocation: 0 }, // position
              { format: 'float32x4', offset: 8, shaderLocation: 1 }, // color
              { format: 'float32', offset: 24, shaderLocation: 2 }, // size
              { format: 'float32', offset: 28, shaderLocation: 3 }, // vertexType
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
      },
    })
  }

  private createUniformBuffer(): void {
    // webgpu-utilsを使用してユニフォーム構造を定義
    const defs = makeShaderDataDefinitions(`
      struct Uniforms {
        projectionMatrix: mat4x4<f32>,
        viewMatrix: mat4x4<f32>,
        canvasSize: vec2<f32>,
        time: f32,
        padding: f32,
      }
    `)

    this.structuredView = makeStructuredView(defs.structs.Uniforms)
    this.uniformValues = this.structuredView.views

    this.uniformBuffer = this.device.createBuffer({
      label: 'VertexEditUniformBuffer',
      size: this.structuredView.arrayBuffer.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    this.bindGroup = this.device.createBindGroup({
      label: 'VertexEditBindGroup',
      layout: this.renderPipeline!.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: this.uniformBuffer },
        },
      ],
    })
  }

  async render(
    renderPass: GPURenderPassEncoder,
    documentContext: DocumentContext,
    camera: Camera2D,
    canvasSize: { width: number; height: number },
    buffersToDestroy: GPUBuffer[],
  ): Promise<void> {
    if (
      !this.renderPipeline ||
      !this.uniformBuffer ||
      !this.bindGroup ||
      !this.vertexEditTool
    ) {
      return
    }

    try {
      const vertices = this.vertexEditTool.getVerticesForRender()
      const handles = this.vertexEditTool.getHandlesForRender()

      if (vertices.length === 0 && handles.length === 0) {
        return
      }

      // ユニフォームバッファ更新
      this.updateUniforms(camera, canvasSize)

      // 頂点データを作成
      const vertexData: number[] = []

      // 頂点を追加
      for (const vertex of vertices) {
        const isSelected = this.vertexEditTool.state.selectedVertices.has(
          vertex.id,
        )
        const isHovered = this.vertexEditTool.state.hoveredVertex === vertex.id

        let color: [number, number, number, number]
        if (isSelected) {
          color = [0.2, 0.6, 1.0, 1.0] // 選択時：青
        } else if (isHovered) {
          color = [1.0, 0.8, 0.2, 1.0] // ホバー時：オレンジ
        } else {
          color = [0.4, 0.4, 0.4, 1.0] // 通常：グレー
        }

        this.addVertexData(vertexData, vertex.position, color, 6.0, 0.0) // vertexType 0 = vertex
      }

      // ハンドルを追加
      for (const handle of handles) {
        const vertex = vertices.find((v) => v.id === handle.parentVertexId)
        if (!vertex) continue

        const isSelected = this.vertexEditTool.state.selectedHandles.has(
          handle.id,
        )
        const isHovered = this.vertexEditTool.state.hoveredHandle === handle.id

        let color: [number, number, number, number]
        if (isSelected) {
          color = [1.0, 0.4, 0.4, 1.0] // 選択時：赤
        } else if (isHovered) {
          color = [1.0, 0.8, 0.2, 1.0] // ホバー時：オレンジ
        } else {
          color = [0.6, 0.6, 0.6, 0.8] // 通常：薄いグレー
        }

        // ハンドル円
        this.addVertexData(vertexData, handle.position, color, 4.0, 1.0) // vertexType 1 = handle

        // 接続線（頂点からハンドルへ）
        const lineColor: [number, number, number, number] = [0.5, 0.5, 0.5, 0.6]
        this.addConnectionLine(
          vertexData,
          vertex.position,
          handle.position,
          lineColor,
        )
      }

      if (vertexData.length === 0) {
        return
      }

      // 頂点バッファ作成
      const vertexBuffer = this.device.createBuffer({
        label: 'VertexEditVertexBuffer',
        size: vertexData.length * 4, // float32
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      })

      this.device.queue.writeBuffer(
        vertexBuffer,
        0,
        new Float32Array(vertexData),
      )
      buffersToDestroy.push(vertexBuffer)

      // レンダリング実行
      renderPass.setPipeline(this.renderPipeline)
      renderPass.setBindGroup(0, this.bindGroup)
      renderPass.setVertexBuffer(0, vertexBuffer)
      renderPass.draw(6, vertexData.length / 8) // 8 = stride in float32s
    } catch (error) {
      console.error('VertexEditRenderer render error:', error)
      // レンダリングエラーが発生した場合はスキップ
    }
  }

  private addVertexData(
    vertexData: number[],
    position: Vector2,
    color: [number, number, number, number],
    size: number,
    vertexType: number,
  ): void {
    // 1つの要素につき6回（クアッド用）追加
    for (let i = 0; i < 6; i++) {
      vertexData.push(
        position.x,
        position.y, // position
        ...color, // color
        size, // size
        vertexType, // vertexType
      )
    }
  }

  private addConnectionLine(
    vertexData: number[],
    start: Vector2,
    end: Vector2,
    color: [number, number, number, number],
  ): void {
    const segments = 8
    for (let i = 0; i < segments; i++) {
      const t = i / segments
      const x = start.x + (end.x - start.x) * t
      const y = start.y + (end.y - start.y) * t

      for (let j = 0; j < 6; j++) {
        vertexData.push(
          x,
          y, // position
          ...color, // color
          1.0, // size
          2.0, // vertexType = connection line
        )
      }
    }
  }

  private updateUniforms(
    camera: Camera2D,
    canvasSize: { width: number; height: number },
  ): void {
    if (!this.uniformBuffer || !this.uniformValues || !this.structuredView)
      return

    const projectionMatrix = camera.getProjectionMatrix(
      canvasSize.width,
      canvasSize.height,
    )
    const viewMatrix = camera.getViewMatrix(canvasSize.width, canvasSize.height)
    const time = performance.now() * 0.001

    // webgpu-utilsのstructured viewを使用してデータを設定
    this.uniformValues.projectionMatrix.set(projectionMatrix)
    this.uniformValues.viewMatrix.set(viewMatrix)
    this.uniformValues.canvasSize.set([canvasSize.width, canvasSize.height])
    this.uniformValues.time.set(time)
    this.uniformValues.padding.set(0)

    // バッファーに書き込み
    this.device.queue.writeBuffer(
      this.uniformBuffer,
      0,
      this.structuredView.arrayBuffer,
      0,
      this.structuredView.arrayBuffer.byteLength,
    )
  }

  isEnabled(): boolean {
    return (
      this.vertexEditTool !== null &&
      (this.vertexEditTool.getVerticesForRender().length > 0 ||
        this.vertexEditTool.getHandlesForRender().length > 0)
    )
  }

  destroy(): void {
    this.uniformBuffer?.destroy()
    this.renderPipeline = null
    this.uniformBuffer = null
    this.bindGroup = null
  }
}
