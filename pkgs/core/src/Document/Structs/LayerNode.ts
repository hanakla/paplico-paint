export const ROOT_LAYER_NODE_UID = '__root__'

export interface LayerNode {
  visuUid: string
  children: LayerNode[]
}
