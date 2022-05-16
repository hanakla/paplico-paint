import Reconciler from 'react-reconciler'
import { Document, RasterLayer } from '../DOM'
import { DocumentConnector } from './Connector/Document'
import { ListConnector } from './Connector/ListConnector'

const constructors = {
  document: Document,
}

const reconciler = Reconciler({
  createInstance(type: string, props: any, root, host) {
    console.log(type, root)

    switch (type) {
      case 'document':
        return new DocumentConnector(Document.create(props))
      case 'layerlist':
        return new ListConnector()
      case 'rasterlayer':
        return RasterLayer.create(props)
    }
  },
  appendInitialChild: (parent, child) => {
    if (!child) return

    if (child.type === 'layerlist' && parent.type !== 'document') {
      throw new Error('Cannot append layerlist to non-document')
    }

    console.log(parent, child)
    // parent?.appendChild(child)
    // console.log('append', parent, child)
  },
  appendChildToContainer: () => {},
  removeChildFromContainer: (container, child) => true,
  finalizeInitialChildren: () => true,

  getRootHostContext: (root) => null,
  getChildHostContext: (parentHostContext: any) => parentHostContext,

  prepareForCommit: () => null,
  resetAfterCommit: () => {},
  detachDeletedInstance: () => {},
  commitMount: () => {},

  clearContainer: () => false,

  shouldSetTextContent: () => false,

  supportsMutation: true,
  isPrimaryRenderer: false,
})

export const PaplicoRenderer = {
  render(element: any, target: {}) {
    const container = reconciler.createContainer(
      target,
      0,
      {
        onHydrated: () => {},
        onDeleted: () => {},
      },
      false,
      false,
      'paplico',
      () => {},
      {}
    )

    reconciler.updateContainer(element, container, null, null)
  },
}
