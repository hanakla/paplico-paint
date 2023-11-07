import { LayerNode, PaplicoDocument, VisuElement } from '@/Document'
import { createGroupVisually } from '@/Document/Visually/factory'

export function mockDocument(
  layerNode: LayerNode[],
  visues: VisuElement.AnyElement[] = [],
) {
  const doc = new PaplicoDocument({ width: 0, height: 0 })
  doc.visuElements.push(...visues)
  doc.layerTreeRoot.children.push(...layerNode)
  return doc
}

export function mockNode(id: string, children: LayerNode[] = []) {
  return { visuUid: id, children }
}

export function fakeVisu<K extends VisuElement.AnyElement['type']>(
  type: K,
  uid: string = `fake-${type}`,
) {
  const visu = createGroupVisually({})
  visu.uid = uid
  ;(visu.type as any) = type

  return visu
}
