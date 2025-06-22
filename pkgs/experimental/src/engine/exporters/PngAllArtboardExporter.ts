import type { DocumentContext } from '../document-manager'
import type { PaplicoEngine } from '../paplico'
import { debugState, type WebGPUEngine } from '../webgpu/core-engine'
import type { IExporterStrategy } from './IExporterStrategy'

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
    engine: PaplicoEngine,
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
        engine.getWebGPUEngine(),
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
      this.options.selectedArtboardIds?.includes(ab.id),
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

    // アートボード領域を指定してレンダリング（documentContextを渡す）
    const imageData = await webgpuEngine.renderRegionToImageData(
      bounds,
      undefined,
      undefined,
      documentContext,
    )

    if (!imageData) {
      throw new Error(
        `Failed to render artboard ${artboard.name || artboard.id}`,
      )
    }

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

    return file
  }
}
