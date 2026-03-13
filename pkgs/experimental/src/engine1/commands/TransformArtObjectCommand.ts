/**
 * ArtObjectのTransform変更コマンド
 */

import type { Transform, UUID } from '../document/types';
import { generateUid } from '../document/utils';
import type { DocumentManager } from '../document-manager';
import type { ICommand } from './base';

export interface TransformArtObjectCommandParams {
  artObjectId: string;
  newTransform: Partial<Transform>;
  oldTransform?: Partial<Transform>;
}

export class TransformArtObjectCommand implements ICommand {
  readonly id: UUID;
  readonly type = 'transform-art-object';
  readonly timestamp: Date;

  private params: TransformArtObjectCommandParams;
  private documentManager: DocumentManager;

  constructor(
    params: TransformArtObjectCommandParams,
    documentManager: DocumentManager,
  ) {
    this.id = generateUid();
    this.timestamp = new Date();
    this.params = params;
    this.documentManager = documentManager;
  }

  canUndo(): boolean {
    return true;
  }

  execute(document: any): void {
    if (!document) {
      throw new Error('No document provided for TransformArtObjectCommand');
    }

    const artObject = document.artObjects[this.params.artObjectId];
    if (!artObject) {
      throw new Error(`ArtObject with ID ${this.params.artObjectId} not found`);
    }

    // 元のtransformを保存（undo用）
    if (!this.params.oldTransform) {
      this.params.oldTransform = { ...artObject.transform };
    }

    // 新しいtransformを適用
    Object.assign(artObject.transform, this.params.newTransform);

    // ドキュメントの更新日時を更新
    document.updatedAt = new Date();
  }

  undo(document: any): void {
    if (!document) {
      throw new Error(
        'No document provided for TransformArtObjectCommand undo',
      );
    }

    const artObject = document.artObjects[this.params.artObjectId];
    if (!artObject) {
      throw new Error(`ArtObject with ID ${this.params.artObjectId} not found`);
    }

    if (!this.params.oldTransform) {
      throw new Error('No old transform data for undo');
    }

    // 元のtransformを復元
    Object.assign(artObject.transform, this.params.oldTransform);

    // ドキュメントの更新日時を更新
    document.updatedAt = new Date();
  }

  getDescription(): string {
    return `Transform ArtObject ${this.params.artObjectId}`;
  }

  canMergeWith(other: ICommand): boolean {
    if (other.type !== 'transform-art-object') return false;

    const otherCommand = other as TransformArtObjectCommand;
    return (
      otherCommand.params.artObjectId === this.params.artObjectId &&
      Date.now() - this.timestamp.getTime() < 500 // 500ms以内なら結合可能
    );
  }

  mergeWith(other: ICommand): ICommand | null {
    if (!this.canMergeWith(other)) return null;

    const otherCommand = other as TransformArtObjectCommand;

    // 新しいコマンドを作成（最初のoldTransformと最後のnewTransformを使用）
    return new TransformArtObjectCommand(
      {
        artObjectId: this.params.artObjectId,
        newTransform: otherCommand.params.newTransform,
        oldTransform: this.params.oldTransform,
      },
      this.documentManager,
    );
  }
}
