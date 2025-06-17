import { encodeCbor, decodeCbor } from '@std/cbor'
import { Document } from './document'
import { UUID } from './types'

/**
 * プロジェクトファイルのメタデータ
 */
export interface ProjectFileMetadata {
  /** ファイル形式のバージョン */
  version: string
  /** アプリケーション名 */
  application: string
  /** アプリケーションバージョン */
  appVersion: string
  /** ファイル作成日時 */
  createdAt: Date
  /** 最終更新日時 */
  updatedAt: Date
  /** ファイルサイズ（バイト） */
  fileSize?: number
  /** 圧縮されているかどうか */
  compressed: boolean
}

/**
 * プロジェクトファイルの構造
 */
export interface ProjectFile {
  /** メタデータ */
  metadata: ProjectFileMetadata
  /** ドキュメントデータ */
  document: Document
  /** プレビュー画像（Base64エンコード）*/
  preview?: string
  /** カスタムデータ（ユーザー定義） */
  customData?: Record<string, any>
}

/**
 * シリアライゼーションオプション
 */
export interface SerializationOptions {
  /** プレビュー画像を含めるかどうか */
  includePreview?: boolean
  /** データを圧縮するかどうか */
  compress?: boolean
  /** カスタムデータを含めるかどうか */
  includeCustomData?: boolean
  /** アプリケーションバージョン */
  appVersion?: string
}

/**
 * ドキュメントシリアライゼーションクラス
 */
export class DocumentSerializer {
  private static readonly FILE_VERSION = '1.0.0'
  private static readonly APPLICATION_NAME = 'Paplico Paint'

  /**
   * ドキュメントをCBORバイナリに変換
   */
  static serialize(
    document: Document,
    options: SerializationOptions = {},
  ): Uint8Array {
    const {
      includePreview = false,
      compress = false,
      includeCustomData = false,
      appVersion = '1.0.0',
    } = options

    const now = new Date()

    // MapオブジェクトをJSONシリアライズ可能な形式に変換
    const serializedDocument = this.serializeDocument(document)

    const projectFile: ProjectFile = {
      metadata: {
        version: this.FILE_VERSION,
        application: this.APPLICATION_NAME,
        appVersion,
        createdAt: document.createdAt,
        updatedAt: now,
        compressed: compress,
      },
      document: serializedDocument,
      ...(includePreview && { preview: undefined }), // プレビュー生成は後で実装
      ...(includeCustomData && { customData: {} }),
    }

    // CBORエンコード
    let encodedData: Uint8Array
    try {
      encodedData = encodeCbor(projectFile)
    } catch (error) {
      throw new Error(`Failed to encode document to CBOR: ${error}`)
    }

    // 圧縮処理（将来的に実装）
    if (compress) {
      // TODO: gzip圧縮を実装
    }

    return encodedData
  }

  /**
   * CBORバイナリからドキュメントを復元
   */
  static deserialize(data: Uint8Array): {
    document: Document
    metadata: ProjectFileMetadata
  } {
    let projectFile: ProjectFile

    try {
      // CBOR デコード
      projectFile = decodeCbor(data) as ProjectFile
    } catch (error) {
      throw new Error(`Failed to decode CBOR data: ${error}`)
    }

    // バージョン互換性チェック
    if (!this.isVersionCompatible(projectFile.metadata.version)) {
      throw new Error(
        `Unsupported file version: ${projectFile.metadata.version}. ` +
          `Current version: ${this.FILE_VERSION}`,
      )
    }

    // ドキュメントを復元
    const document = this.deserializeDocument(projectFile.document)

    return {
      document,
      metadata: projectFile.metadata,
    }
  }

  /**
   * ドキュメントをシリアライズ可能な形式に変換
   */
  private static serializeDocument(document: Document): any {
    return {
      id: document.id,
      name: document.name,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      artboards: document.artboards,
      layers: Array.from(document.layers.entries()),
      layerNodes: document.layerNodes,
      artObjects: Array.from(document.artObjects.entries()),
      activeArtboardId: document.activeArtboardId,
      activeLayerId: document.activeLayerId,
      selectedArtObjectIds: document.selectedArtObjectIds,
    }
  }

  /**
   * シリアライズされたデータからドキュメントを復元
   */
  private static deserializeDocument(data: any): Document {
    const document: Document = {
      id: data.id,
      name: data.name,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      artboards: data.artboards || [],
      layers: new Map(data.layers || []),
      layerNodes: data.layerNodes || [],
      artObjects: new Map(data.artObjects || []),
      activeArtboardId: data.activeArtboardId,
      activeLayerId: data.activeLayerId,
      selectedArtObjectIds: data.selectedArtObjectIds || [],
    }

    return document
  }

  /**
   * ファイルバージョンの互換性をチェック
   */
  private static isVersionCompatible(fileVersion: string): boolean {
    const [fileMajor, fileMinor] = fileVersion.split('.').map(Number)
    const [currentMajor, currentMinor] =
      this.FILE_VERSION.split('.').map(Number)

    // メジャーバージョンが同じで、ファイルのマイナーバージョンが現在以下の場合は互換性あり
    return fileMajor === currentMajor && fileMinor <= currentMinor
  }

  /**
   * プロジェクトファイルからメタデータのみを抽出
   */
  static extractMetadata(data: Uint8Array): ProjectFileMetadata {
    try {
      const projectFile = decodeCbor(data) as ProjectFile
      return projectFile.metadata
    } catch (error) {
      throw new Error(`Failed to extract metadata: ${error}`)
    }
  }

  /**
   * ファイルサイズの見積もり
   */
  static estimateFileSize(document: Document): number {
    // 簡易的なサイズ計算
    const jsonString = JSON.stringify(this.serializeDocument(document))
    return new TextEncoder().encode(jsonString).length
  }
}

/**
 * ファイル拡張子とMIMEタイプの定義
 */
export const PROJECT_FILE_EXTENSION = '.paplico'
export const PROJECT_FILE_MIME_TYPE = 'application/x-paplico-project'

/**
 * ブラウザでのファイル保存ヘルパー
 */
export class FileIOHelper {
  /**
   * ドキュメントをファイルとしてダウンロード
   */
  static saveDocumentAsFile(
    document: Document,
    filename?: string,
    options: SerializationOptions = {},
  ): void {
    if (typeof window === 'undefined') {
      throw new Error('File saving is only available in browser environment')
    }

    const data = DocumentSerializer.serialize(document, options)
    const blob = new Blob([data], { type: PROJECT_FILE_MIME_TYPE })

    const defaultFilename = `${
      document.name || 'Untitled'
    }${PROJECT_FILE_EXTENSION}`
    const finalFilename = filename || defaultFilename

    // ダウンロードリンクを作成して実行
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = finalFilename
    link.style.display = 'none'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // メモリリークを防ぐためURLを解放
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }

  /**
   * ファイルからドキュメントを読み込み
   */
  static loadDocumentFromFile(
    file: File,
  ): Promise<{ document: Document; metadata: ProjectFileMetadata }> {
    return new Promise((resolve, reject) => {
      if (!file.name.endsWith(PROJECT_FILE_EXTENSION)) {
        reject(
          new Error(
            `Invalid file extension. Expected ${PROJECT_FILE_EXTENSION}`,
          ),
        )
        return
      }

      const reader = new FileReader()

      reader.onload = (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer
          const data = new Uint8Array(arrayBuffer)
          const result = DocumentSerializer.deserialize(data)
          resolve(result)
        } catch (error) {
          reject(error)
        }
      }

      reader.onerror = () => {
        reject(new Error('Failed to read file'))
      }

      reader.readAsArrayBuffer(file)
    })
  }

  /**
   * ファイル選択ダイアログを表示してドキュメントを読み込み
   */
  static openFileDialog(): Promise<{
    document: Document
    metadata: ProjectFileMetadata
  }> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(
          new Error('File opening is only available in browser environment'),
        )
        return
      }

      const input = document.createElement('input')
      input.type = 'file'
      input.accept = PROJECT_FILE_EXTENSION
      input.style.display = 'none'

      input.onchange = (event) => {
        const file = (event.target as HTMLInputElement).files?.[0]
        if (file) {
          this.loadDocumentFromFile(file).then(resolve).catch(reject)
        } else {
          reject(new Error('No file selected'))
        }
      }

      document.body.appendChild(input)
      input.click()
      document.body.removeChild(input)
    })
  }
}

/**
 * ドキュメント変換ユーティリティ
 */
export class DocumentConverter {
  /**
   * ドキュメントをJSON形式にエクスポート
   */
  static toJSON(document: Document, pretty: boolean = false): string {
    const serialized = DocumentSerializer['serializeDocument'](document)
    return JSON.stringify(serialized, null, pretty ? 2 : 0)
  }

  /**
   * JSON形式からドキュメントをインポート
   */
  static fromJSON(json: string): Document {
    try {
      const data = JSON.parse(json)
      return DocumentSerializer['deserializeDocument'](data)
    } catch (error) {
      throw new Error(`Failed to parse JSON: ${error}`)
    }
  }
}
