export const ROOT_LAYER_NODE_UID = '__root__'

export type LayerNode = {
  visuUid: string
  children: LayerNode[]
}
