import { RGBAColor, BlendMode } from '../../document/types'
import { VectorPath } from '../../document/path'
import { FillAppearance, isFillAppearance } from '../../document/appearance'
import {
  IAppearanceProcessor,
  BoundingBox,
} from '../interfaces/IAppearanceProcessor'
import {
  makeShaderDataDefinitions,
  makeStructuredView,
  createBuffersAndAttributesFromArrays,
} from 'webgpu-utils'
import { debugLogger } from '../../../utils/debug-logger'
import { debugState } from '../core-engine'

/**
 * パスからポリゴンへの三角分割を行う関数
 * Ear Clippingアルゴリズムを使用して凹ポリゴンにも対応
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

  const color = appearance.params.color || { r: 0, g: 0, b: 0, a: 1 }
  const opacity = appearance.params.opacity || 1
  const rgba = [color.r, color.g, color.b, color.a * opacity]

  // 単純な場合（三角形）はそのまま返す
  if (uniquePoints.length === 3) {
    const triangles: number[] = []
    for (const point of uniquePoints) {
      triangles.push(point.x, point.y, ...rgba)
    }
    return new Float32Array(triangles)
  }

  // 4点以上の場合はEar Clippingまたは改良されたファン三角分割を使用
  const triangles: number[] = []

  // ポリゴンの方向を確認（時計回り/反時計回り）
  const isClockwise = calculatePolygonOrientation(uniquePoints)

  // 反時計回りになるように調整
  const orderedPoints = isClockwise ? uniquePoints.reverse() : uniquePoints

  // 改良されたファン三角分割（凸ポリゴンの場合に最適化）
  if (isConvexPolygon(orderedPoints)) {
    // 凸ポリゴンの場合はファン三角分割を使用
    const center = orderedPoints[0]
    for (let i = 1; i < orderedPoints.length - 1; i++) {
      const p1 = orderedPoints[i]
      const p2 = orderedPoints[i + 1]

      // 反時計回りで三角形を追加
      triangles.push(center.x, center.y, ...rgba)
      triangles.push(p1.x, p1.y, ...rgba)
      triangles.push(p2.x, p2.y, ...rgba)
    }
  } else {
    // 凹ポリゴンの場合は簡略化されたEar Clippingを使用
    const triangulatedPoints = earClippingTriangulation(orderedPoints)
    for (const triangle of triangulatedPoints) {
      for (const point of triangle) {
        triangles.push(point.x, point.y, ...rgba)
      }
    }
  }

  return new Float32Array(triangles)
}

/**
 * ポリゴンの方向を計算（時計回り=true, 反時計回り=false）
 */
function calculatePolygonOrientation(
  points: { x: number; y: number }[],
): boolean {
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length
    area += (points[j].x - points[i].x) * (points[j].y + points[i].y)
  }
  return area > 0
}

/**
 * ポリゴンが凸かどうかを判定
 */
function isConvexPolygon(points: { x: number; y: number }[]): boolean {
  if (points.length < 4) return true

  let sign = 0
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i]
    const p2 = points[(i + 1) % points.length]
    const p3 = points[(i + 2) % points.length]

    const cross = (p2.x - p1.x) * (p3.y - p2.y) - (p2.y - p1.y) * (p3.x - p2.x)

    if (cross !== 0) {
      const currentSign = cross > 0 ? 1 : -1
      if (sign === 0) {
        sign = currentSign
      } else if (sign !== currentSign) {
        return false
      }
    }
  }
  return true
}

/**
 * 簡略化されたEar Clippingアルゴリズム
 */
function earClippingTriangulation(
  points: { x: number; y: number }[],
): { x: number; y: number }[][] {
  const triangles: { x: number; y: number }[][] = []
  const vertices = [...points]

  while (vertices.length > 3) {
    let earFound = false

    for (let i = 0; i < vertices.length; i++) {
      const prev = vertices[(i - 1 + vertices.length) % vertices.length]
      const curr = vertices[i]
      const next = vertices[(i + 1) % vertices.length]

      if (isEar(prev, curr, next, vertices)) {
        triangles.push([prev, curr, next])
        vertices.splice(i, 1)
        earFound = true
        break
      }
    }

    if (!earFound) {
      // Ear が見つからない場合はファン三角分割にフォールバック
      const center = vertices[0]
      for (let i = 1; i < vertices.length - 1; i++) {
        triangles.push([center, vertices[i], vertices[i + 1]])
      }
      break
    }
  }

  if (vertices.length === 3) {
    triangles.push(vertices)
  }

  return triangles
}

/**
 * 三角形がEar（耳）かどうかを判定
 */
function isEar(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  vertices: { x: number; y: number }[],
): boolean {
  // 三角形が反時計回りかチェック
  const cross = (p2.x - p1.x) * (p3.y - p2.y) - (p2.y - p1.y) * (p3.x - p2.x)
  if (cross <= 0) return false

  // 他の頂点が三角形内部にないかチェック
  for (const vertex of vertices) {
    if (vertex === p1 || vertex === p2 || vertex === p3) continue
    if (pointInTriangle(vertex, p1, p2, p3)) return false
  }

  return true
}

/**
 * 点が三角形内部にあるかどうかを判定
 */
function pointInTriangle(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): boolean {
  const sign = (
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number },
  ) => {
    return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y)
  }

  const d1 = sign(p, a, b)
  const d2 = sign(p, b, c)
  const d3 = sign(p, c, a)

  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0

  return !(hasNeg && hasPos)
}

/**
 * Fill描画用のレンダラー
 * WebGPUを使用してfill appearanceを描画
 * webgpu-utilsを使用して実装を簡素化
 */
export class FillRenderer implements IAppearanceProcessor {
  private device: GPUDevice
  private renderPipeline: GPURenderPipeline | null = null
  private offscreenRenderPipeline: GPURenderPipeline | null = null // オフスクリーン用
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

      // メインキャンバス用レンダーパイプラインを作成
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
        primitive: {
          topology: 'triangle-list',
          cullMode: 'none', // 面カリングを無効化
        },
      })

      // オフスクリーン用レンダーパイプラインを作成
      this.offscreenRenderPipeline = this.device.createRenderPipeline({
        label: 'FillOffscreenRenderPipeline',
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
              format: navigator.gpu.getPreferredCanvasFormat(), // キャンバスと同じフォーマット
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
        primitive: {
          topology: 'triangle-list',
          cullMode: 'none', // 面カリングを無効化
        },
      })
    } catch (error) {
      throw error
    }
  }

  /**
   * パスをfill appearanceで描画
   * @returns 破棄が必要なバッファの配列と更新されたバウンディングボックス
   */
  async render(
    renderPass: GPURenderPassEncoder,
    path: VectorPath,
    appearance: FillAppearance,
    projectionMatrix: Float32Array,
    viewMatrix: Float32Array,
    canvasSize: { width: number; height: number },
    inputBounds: BoundingBox,
  ): Promise<{ buffers: GPUBuffer[]; bounds: BoundingBox }> {
    if (
      !this.renderPipeline ||
      !this.offscreenRenderPipeline ||
      !this.uniformBuffer ||
      !this.bindGroup
    ) {
      return { buffers: [], bounds: inputBounds }
    }

    // レンダーパスの種類に応じて適切なパイプラインを選択
    // オフスクリーンレンダーパスかどうかをラベルで判定
    const renderPassLabel = (renderPass as any).label || ''
    const isOffscreenPass = renderPassLabel.includes('Offscreen')
    const selectedPipeline = isOffscreenPass
      ? this.offscreenRenderPipeline
      : this.renderPipeline

    // デバッグ情報を記録（シェーダー段階テスト用）
    debugState.export.errors.push(
      `DEBUG-TOKEN-DEF789: FillRenderer called - isOffscreen: ${isOffscreenPass}, label: "${renderPassLabel}"`,
    )
    debugState.export.errors.push(
      `DEBUG-TOKEN-DEF789: Pipeline selected: ${
        selectedPipeline ? (isOffscreenPass ? 'offscreen' : 'main') : 'null'
      }`,
    )

    // パスが閉じていない場合は塗りつぶししない
    if (!path.closed) {
      return { buffers: [], bounds: inputBounds }
    }

    // パスの点が3点未満の場合は描画しない
    if (path.points.length < 3) {
      return { buffers: [], bounds: inputBounds }
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
      return { buffers: [], bounds: inputBounds }
    }

    const totalVertexCount = triangles.length / 6

    // 三角分割結果の詳細ログ（最初の数個の頂点）
    if (isOffscreenPass) {
      const firstFewVertices = triangles.slice(
        0,
        Math.min(18, triangles.length),
      ) // 最初の3つの頂点

      // 三角形の詳細分析
      const triangleCount = Math.min(2, Math.floor(triangles.length / 18)) // 最初の2つの三角形
      for (let i = 0; i < triangleCount; i++) {
        const startIdx = i * 18
        const v1 = { x: triangles[startIdx], y: triangles[startIdx + 1] }
        const v2 = { x: triangles[startIdx + 6], y: triangles[startIdx + 7] }
        const v3 = { x: triangles[startIdx + 12], y: triangles[startIdx + 13] }

        // 投影変換後の座標を計算
        const transformVertex = (x: number, y: number) => {
          // 4x4行列変換を適用（簡略化）
          const projX = projectionMatrix[0] * x + projectionMatrix[12]
          const projY = projectionMatrix[5] * y + projectionMatrix[13]
          return { x: projX, y: projY }
        }

        const tv1 = transformVertex(v1.x, v1.y)
        const tv2 = transformVertex(v2.x, v2.y)
        const tv3 = transformVertex(v3.x, v3.y)

        // NDC範囲チェック
        const allVerts = [tv1, tv2, tv3]
        const inRange = allVerts.every(
          (v) => v.x >= -1 && v.x <= 1 && v.y >= -1 && v.y <= 1,
        )
      }

      // バウンディングボックスの確認
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity
      for (let i = 0; i < triangles.length; i += 6) {
        const x = triangles[i]
        const y = triangles[i + 1]
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }

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
      // 選択されたパイプラインを使用
      renderPass.setPipeline(selectedPipeline)

      renderPass.setBindGroup(0, this.bindGroup)

      // 手動作成したバッファを設定
      renderPass.setVertexBuffer(0, vertexBuffer)

      // 頂点数で描画

      // デバッグ: レンダーパス情報を確認
      if (isOffscreenPass) {
        debugState.export.errors.push(
          `DEBUG-TOKEN-YZA456: FillRenderer about to draw ${vertexCount} vertices`,
        )
        debugState.export.errors.push(
          `DEBUG-TOKEN-YZA456: RenderPass exists: ${renderPass ? 'YES' : 'NO'}`,
        )
        debugState.export.errors.push(
          `DEBUG-TOKEN-YZA456: VertexBuffer created: ${
            vertexBuffer ? 'YES' : 'NO'
          }`,
        )
        debugState.export.errors.push(
          `DEBUG-TOKEN-YZA456: Pipeline exists: ${
            selectedPipeline ? 'YES' : 'NO'
          }`,
        )
        debugState.export.errors.push(
          `DEBUG-TOKEN-YZA456: BindGroup exists: ${
            this.bindGroup ? 'YES' : 'NO'
          }`,
        )

        // 頂点データのサンプル（最初の数値だけ）
        const sampleData = Array.from(triangles.slice(0, 12))
          .map((v) => v.toFixed(2))
          .join(',')
        debugState.export.errors.push(
          `DEBUG-TOKEN-YZA456: Vertex data sample: [${sampleData}]`,
        )

        // 色データの確認
        const color = appearance.params.color || { r: 0, g: 0, b: 0, a: 1 }
        const opacity = appearance.params.opacity || 1
        debugState.export.errors.push(
          `DEBUG-TOKEN-YZA456: Color: RGBA(${color.r},${color.g},${color.b},${color.a}) opacity: ${opacity}`,
        )

        // カメラ行列の確認
        debugState.export.errors.push(
          `DEBUG-TOKEN-YZA456: Canvas size: ${canvasSize.width}x${canvasSize.height}`,
        )
        debugState.export.errors.push(
          `DEBUG-TOKEN-YZA456: ProjectionMatrix sample: [${Array.from(
            projectionMatrix.slice(0, 4),
          )
            .map((v) => v.toFixed(3))
            .join(',')}]`,
        )
        debugState.export.errors.push(
          `DEBUG-TOKEN-YZA456: ViewMatrix sample: [${Array.from(
            viewMatrix.slice(0, 4),
          )
            .map((v) => v.toFixed(3))
            .join(',')}]`,
        )

        // 最初の頂点のNDC変換を手動計算
        const firstVertX = triangles[0]
        const firstVertY = triangles[1]

        // 4x4行列変換（簡略化）
        const worldPos = [firstVertX, firstVertY, 0, 1]
        const viewPos = [
          viewMatrix[0] * worldPos[0] +
            viewMatrix[4] * worldPos[1] +
            viewMatrix[8] * worldPos[2] +
            viewMatrix[12] * worldPos[3],
          viewMatrix[1] * worldPos[0] +
            viewMatrix[5] * worldPos[1] +
            viewMatrix[9] * worldPos[2] +
            viewMatrix[13] * worldPos[3],
          viewMatrix[2] * worldPos[0] +
            viewMatrix[6] * worldPos[1] +
            viewMatrix[10] * worldPos[2] +
            viewMatrix[14] * worldPos[3],
          viewMatrix[3] * worldPos[0] +
            viewMatrix[7] * worldPos[1] +
            viewMatrix[11] * worldPos[2] +
            viewMatrix[15] * worldPos[3],
        ]

        const projPos = [
          projectionMatrix[0] * viewPos[0] +
            projectionMatrix[4] * viewPos[1] +
            projectionMatrix[8] * viewPos[2] +
            projectionMatrix[12] * viewPos[3],
          projectionMatrix[1] * viewPos[0] +
            projectionMatrix[5] * viewPos[1] +
            projectionMatrix[9] * viewPos[2] +
            projectionMatrix[13] * viewPos[3],
          projectionMatrix[2] * viewPos[0] +
            projectionMatrix[6] * viewPos[1] +
            projectionMatrix[10] * viewPos[2] +
            projectionMatrix[14] * viewPos[3],
          projectionMatrix[3] * viewPos[0] +
            projectionMatrix[7] * viewPos[1] +
            projectionMatrix[11] * viewPos[2] +
            projectionMatrix[15] * viewPos[3],
        ]

        const ndcX = projPos[0] / projPos[3]
        const ndcY = projPos[1] / projPos[3]

        debugState.export.errors.push(
          `DEBUG-TOKEN-YZA456: Manual NDC calc for (${firstVertX},${firstVertY}): NDC(${ndcX.toFixed(
            3,
          )},${ndcY.toFixed(3)})`,
        )
        debugState.export.errors.push(
          `DEBUG-TOKEN-YZA456: NDC in range: ${
            ndcX >= -1 && ndcX <= 1 && ndcY >= -1 && ndcY <= 1 ? 'YES' : 'NO'
          }`,
        )
      }

      renderPass.draw(vertexCount)

      if (isOffscreenPass) {
        debugState.export.errors.push(
          `DEBUG-TOKEN-YZA456: FillRenderer draw call completed for ${vertexCount} vertices`,
        )
      }

      // 手動作成したバッファを返して、呼び出し元で破棄管理
      // TODO: 実際のパスバウンディングボックスを計算
      const updatedBounds = this.calculateBounds(path, appearance, inputBounds)
      return { buffers: [vertexBuffer], bounds: updatedBounds }
    } catch (error) {
      throw error
    }
  }

  /**
   * アピアランスが適用される予想バウンディングボックスを計算する
   */
  calculateBounds(
    path: VectorPath,
    appearance: FillAppearance,
    inputBounds: BoundingBox,
  ): BoundingBox {
    if (!path.closed || path.points.length < 3) {
      return inputBounds
    }

    // パスの最小・最大座標を計算
    let minX = Infinity,
      minY = Infinity
    let maxX = -Infinity,
      maxY = -Infinity

    for (const point of path.points) {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    }

    // fill appearanceは線幅を持たないので、パスの座標そのままがバウンディングボックス
    const pathBounds: BoundingBox = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    }

    // inputBoundsと結合（union）
    if (inputBounds.width === 0 && inputBounds.height === 0) {
      return pathBounds
    }

    const combinedMinX = Math.min(inputBounds.x, pathBounds.x)
    const combinedMinY = Math.min(inputBounds.y, pathBounds.y)
    const combinedMaxX = Math.max(
      inputBounds.x + inputBounds.width,
      pathBounds.x + pathBounds.width,
    )
    const combinedMaxY = Math.max(
      inputBounds.y + inputBounds.height,
      pathBounds.y + pathBounds.height,
    )

    return {
      x: combinedMinX,
      y: combinedMinY,
      width: combinedMaxX - combinedMinX,
      height: combinedMaxY - combinedMinY,
    }
  }

  /**
   * リソースを解放
   */
  dispose(): void {
    this.uniformBuffer?.destroy()
    this.uniformBuffer = null
    this.renderPipeline = null
    this.offscreenRenderPipeline = null
    this.bindGroup = null
    this.bindGroupLayout = null
  }
}
