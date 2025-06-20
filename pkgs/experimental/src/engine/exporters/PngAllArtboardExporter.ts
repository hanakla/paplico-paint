import { IExporterStrategy } from './IExporterStrategy'
import { DocumentContext } from '../document-manager'
import { WebGPUEngine } from '../webgpu/core-engine'
import { debugState } from '../webgpu/core-engine'

export interface PngExportOptions {
  /** 選択されたアートボードIDの配列。空の場合は全アートボードを書き出し */
  selectedArtboardIds?: string[]
}

/**
 * アートボードをPNG形式で書き出すエクスポーター
 */
export class PngAllArtboardExporter implements IExporterStrategy {
  readonly name = 'PNG Artboards'
  readonly exportFileExtension = 'png'

  private options: PngExportOptions

  constructor(options: PngExportOptions = {}) {
    this.options = options
  }

  async export(
    documentContext: DocumentContext,
    webgpuEngine: WebGPUEngine,
  ): Promise<File[]> {
    const document = documentContext.document

    const artboardsArray = document.artboards
      ? Object.values(document.artboards)
      : []

    if (artboardsArray.length === 0) {
      throw new Error(
        `No artboards found in document. document.artboards = ${JSON.stringify(
          document.artboards,
        )}`,
      )
    }

    // debugState.export.errorsをクリア
    debugState.export.errors = []

    // ドキュメント内容をdebugStateに記録
    debugState.stroke.document.artObjectCount = Object.keys(
      document.artObjects,
    ).length
    debugState.stroke.document.layerCount = Object.keys(document.layers).length

    // 対象アートボードを取得
    const targetArtboards = this.getTargetArtboards(artboardsArray)

    if (targetArtboards.length === 0) {
      throw new Error('No target artboards found for export')
    }

    // エクスポート開始時刻を記録
    debugState.export.lastExportTime = performance.now()

    const files: File[] = []

    // 各アートボードを個別に書き出し
    for (const artboard of targetArtboards) {
      const bounds = artboard.bounds

      if (bounds.width <= 0 || bounds.height <= 0) {
        console.warn(`Skipping artboard ${artboard.name} due to invalid bounds`)
        continue
      }

      const file = await this.exportArtboard(
        artboard,
        documentContext,
        webgpuEngine,
      )
      files.push(file)
    }

    return files
  }

  /**
   * 対象となるアートボードを取得
   */
  private getTargetArtboards(artboards: any[]) {
    const visibleArtboards = artboards.filter((ab) => ab.visible)

    if (
      !this.options.selectedArtboardIds ||
      this.options.selectedArtboardIds.length === 0
    ) {
      return visibleArtboards
    }

    return visibleArtboards.filter((ab) =>
      this.options.selectedArtboardIds!.includes(ab.id),
    )
  }

  /**
   * 単一アートボードを書き出し（効率的な部分レンダリング使用）
   */
  private async exportArtboard(
    artboard: any,
    documentContext: DocumentContext,
    webgpuEngine: WebGPUEngine,
  ): Promise<File> {
    const bounds = artboard.bounds

    // アートボード情報をdebugStateに記録
    debugState.export.artboard.name = artboard.name || artboard.id
    debugState.export.artboard.bounds = bounds
    debugState.export.artboard.renderStartTime = performance.now()

    // エクスポート用のエラーログをクリア
    debugState.export.errors.push('=== Starting artboard export ===')

    // アートボード内にあるアートオブジェクトを調査
    const doc = documentContext.document
    let objectCount = 0
    const artObjectsInArtboard = Object.values(doc.artObjects).filter(
      (obj: any) => {
        if (
          obj.type !== 'path' ||
          !obj.path?.points ||
          obj.path.points.length === 0
        )
          return false

        // transformを考慮した座標計算
        const transformX = obj.transform?.x || 0
        const transformY = obj.transform?.y || 0

        // パスの境界とアートボードの境界の重なりをチェック
        const xs = obj.path.points.map((p: any) => p.x + transformX)
        const ys = obj.path.points.map((p: any) => p.y + transformY)
        const minX = Math.min(...xs),
          maxX = Math.max(...xs)
        const minY = Math.min(...ys),
          maxY = Math.max(...ys)

        // 重なり判定
        const overlaps = !(
          maxX < bounds.x ||
          minX > bounds.x + bounds.width ||
          maxY < bounds.y ||
          minY > bounds.y + bounds.height
        )

        // デバッグ情報を記録（最初の5つまで）
        if (overlaps && objectCount < 5) {
          debugState.export.errors.push(
            `Object ${obj.id}: bounds (${minX.toFixed(1)},${minY.toFixed(
              1,
            )})-(${maxX.toFixed(1)},${maxY.toFixed(1)})`,
          )
          objectCount++
        }

        return overlaps
      },
    )

    // アートボード内のアートオブジェクト数を記録
    debugState.export.artboard.artObjectsInside = artObjectsInArtboard.length

    // renderRegionToImageDataを使用してアートボード領域をレンダリング
    debugState.export.errors.push('Using renderRegionToImageData approach')
    debugState.export.errors.push(`Artboard bounds: ${JSON.stringify(bounds)}`)

    // アートボード領域を指定してレンダリング（documentContextを渡す）
    const imageData = await webgpuEngine.renderRegionToImageData(
      bounds,
      undefined,
      undefined,
      documentContext,
    )

    debugState.export.errors.push(
      `ImageData result: ${
        imageData ? `${imageData.width}x${imageData.height}` : 'null'
      }`,
    )

    if (!imageData) {
      debugState.export.errors.push(
        `ImageData is null for artboard ${artboard.name || artboard.id}`,
      )
      throw new Error(
        `Failed to render artboard ${artboard.name || artboard.id}`,
      )
    }

    // ImageDataの分析をdebugStateに記録
    const pixels = imageData.data
    let nonTransparentPixels = 0
    let alphaMin = 255
    let alphaMax = 0

    debugState.export.errors.push(
      `Analyzing ImageData: ${imageData.width}x${imageData.height}, ${pixels.length} bytes`,
    )

    for (let i = 3; i < pixels.length; i += 4) {
      const alpha = pixels[i]
      if (alpha > 0) {
        nonTransparentPixels++
      }
      alphaMin = Math.min(alphaMin, alpha)
      alphaMax = Math.max(alphaMax, alpha)
    }

    debugState.export.imageData.width = imageData.width
    debugState.export.imageData.height = imageData.height
    debugState.export.imageData.alphaMin = alphaMin
    debugState.export.imageData.alphaMax = alphaMax
    debugState.export.imageData.nonTransparentPixels = nonTransparentPixels
    debugState.export.imageData.totalPixels = pixels.length / 4

    // デバッグ情報を出力
    debugState.export.errors.push(
      `Pixel analysis: ${nonTransparentPixels}/${
        pixels.length / 4
      } non-transparent, alpha range: ${alphaMin}-${alphaMax}`,
    )

    // ImageDataをCanvasでPNGに変換
    const canvas = globalThis.document.createElement('canvas')
    canvas.width = imageData.width
    canvas.height = imageData.height

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Failed to get 2D context for PNG conversion')
    }

    // ImageDataをcanvasに描画
    ctx.putImageData(imageData, 0, 0)

    // キャンバスからBlobを生成
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob: Blob | null) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to convert canvas to blob'))
        }
      }, 'image/png')
    })

    // Fileオブジェクトとして返す
    const fileName = `${artboard.name || `artboard-${artboard.id}`}.png`
    const file = new File([blob], fileName, { type: 'image/png' })

    // エクスポート完了をdebugStateに記録
    debugState.export.lastExportTime =
      performance.now() - debugState.export.lastExportTime

    return file
  }
}
