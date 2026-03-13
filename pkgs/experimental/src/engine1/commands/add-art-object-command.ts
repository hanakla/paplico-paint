import type { Document } from '../document/document';
import type { UUID } from '../document/types';
import { debugState, trackDocumentChange } from '../webgpu/core-engine';
import { BaseCommand } from './base';

/**
 * ArtObject追加コマンド
 */
export interface AddArtObjectCommandParams {
  artObjectId: UUID;
  artObjectData: any;
}

export class AddArtObjectCommand extends BaseCommand {
  public readonly type = 'addArtObject';
  private params: AddArtObjectCommandParams;

  constructor(params: AddArtObjectCommandParams) {
    super();
    this.params = params;
  }

  execute(document: Document): void {
    // 実行前のドキュメント状態を記録
    trackDocumentChange('AddArtObjectCommand:before_execute', document);

    // 実行前の状態をdebugStateに保存
    const beforeState = {
      artObjectsCount: Object.keys(document.artObjects).length,
      layerId: this.params.artObjectData.layerId,
      layerExists: !!document.layers[this.params.artObjectData.layerId],
      layerType: document.layers[this.params.artObjectData.layerId]?.type,
      layerArtObjectIds:
        document.layers[this.params.artObjectData.layerId]?.artObjectIds
          ?.length || 0,
    };

    // デバッグ情報をdebugStateに保存
    debugState.stroke.commandExecution = {
      debugToken: `add-command-v1-${crypto.randomUUID()}`,
      timestamp: new Date().toISOString(),
      action: 'execute_add_art_object_command',
      artObjectId: this.params.artObjectId,
      beforeState,
      artObjectData: {
        id: this.params.artObjectData.id,
        layerId: this.params.artObjectData.layerId,
        type: this.params.artObjectData.type,
        visible: this.params.artObjectData.visible,
        appearances: this.params.artObjectData.appearances?.length || 0,
        hasAppearances: !!this.params.artObjectData.appearances,
        appearancesArray: this.params.artObjectData.appearances || [],
        firstAppearance: this.params.artObjectData.appearances?.[0]
          ? {
              effectId: this.params.artObjectData.appearances[0].effectId,
              enabled: this.params.artObjectData.appearances[0].enabled,
              hasParams: !!this.params.artObjectData.appearances[0].params,
              paramsKeys: this.params.artObjectData.appearances[0].params
                ? Object.keys(this.params.artObjectData.appearances[0].params)
                : [],
            }
          : null,
      },
    };

    // document.artObjectsに追加
    document.artObjects[this.params.artObjectId] = this.params.artObjectData;

    // 所属レイヤーのartObjectIdsに追加
    const layer = document.layers[this.params.artObjectData.layerId];
    if (layer && layer.type === 'vector') {
      layer.artObjectIds.push(this.params.artObjectId);
    }

    document.updatedAt = new Date();

    // 実行後のドキュメント状態を記録
    trackDocumentChange('AddArtObjectCommand:after_execute', document);

    // 実行後の状態をdebugStateに追加保存
    const savedArtObject = document.artObjects[this.params.artObjectId];
    const afterState = {
      artObjectsCount: Object.keys(document.artObjects).length,
      artObjectExists: !!savedArtObject,
      layerArtObjectIds:
        (layer?.type === 'vector' ? layer.artObjectIds?.length : 0) || 0,
      layerContainsId:
        (layer?.type === 'vector'
          ? layer.artObjectIds?.includes(this.params.artObjectId)
          : false) || false,
      savedAppearances: savedArtObject?.appearances?.length || 0,
      savedHasAppearances: !!savedArtObject?.appearances,
      savedFirstAppearance: savedArtObject?.appearances?.[0]
        ? {
            effectId: savedArtObject.appearances[0].effectId,
            enabled: savedArtObject.appearances[0].enabled,
            hasParams: !!savedArtObject.appearances[0].params,
            paramsKeys: savedArtObject.appearances[0].params
              ? Object.keys(savedArtObject.appearances[0].params)
              : [],
          }
        : null,
    };

    // 実行後の状態もdebugStateに追加
    debugState.stroke.commandExecution.afterState = afterState;
    debugState.stroke.commandExecution.success =
      afterState.artObjectExists && afterState.layerContainsId;
  }

  undo(document: Document): void {
    delete document.artObjects[this.params.artObjectId];

    // 所属レイヤーのartObjectIdsからも削除
    const layer = document.layers[this.params.artObjectData.layerId];
    if (layer && layer.type === 'vector') {
      const index = layer.artObjectIds.indexOf(this.params.artObjectId);
      if (index !== -1) {
        layer.artObjectIds.splice(index, 1);
      }
    }

    document.updatedAt = new Date();
  }

  getDescription(): string {
    return `オブジェクト追加: ${this.params.artObjectData.type}`;
  }
}
