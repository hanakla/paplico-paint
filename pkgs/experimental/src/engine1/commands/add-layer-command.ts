import type { Document } from '../document/document';
import type { UUID } from '../document/types';
import { BaseCommand } from './base';

/**
 * レイヤー追加コマンド
 */
export interface AddLayerCommandParams {
  layerId: UUID;
  layerData: any;
  parentId?: UUID | null;
  order?: number;
}

export class AddLayerCommand extends BaseCommand {
  public readonly type = 'addLayer';
  private params: AddLayerCommandParams;

  constructor(params: AddLayerCommandParams) {
    super();
    this.params = params;
  }

  execute(document: Document): void {
    const { layerData, parentId } = this.params;
    document.layers[this.params.layerId] = layerData;

    const order =
      this.params.order ??
      document.layerNodes.filter((node) => node.parentId === parentId).length;

    document.layerNodes.push({
      layerId: this.params.layerId,
      parentId: parentId || null,
      order,
    });

    document.updatedAt = new Date();
  }

  undo(document: Document): void {
    delete document.layers[this.params.layerId];
    const nodeIndex = document.layerNodes.findIndex(
      (node) => node.layerId === this.params.layerId,
    );
    if (nodeIndex !== -1) {
      document.layerNodes.splice(nodeIndex, 1);
    }
    document.updatedAt = new Date();
  }

  getDescription(): string {
    return `レイヤー追加: ${this.params.layerData.name}`;
  }
}
