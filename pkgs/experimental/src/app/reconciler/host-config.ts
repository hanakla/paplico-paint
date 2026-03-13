import type { HostConfig } from 'react-reconciler'
import {
  type ArtObject,
  addArtObjectToDocument,
  addLayerToDocument,
  createDocument,
  createPathArtObject,
  createVectorLayer,
  type Document,
  isFillAppearance,
  isPathArtObject,
  type Layer,
} from '@/engine/document'
import {
  cleanupGPUResources,
  rebuildRenderQueue,
  renderFrame,
} from './render-utils'
import { generateVerticesFromPath } from './vertex-generator'
import type { WebGPUElement } from './webgpu-element'
import { createWebGPUElement, markElementDirty } from './webgpu-element'
import type { WebGPUStore } from './webgpu-store'

type Type = string
type Props = Record<string, unknown>
type Container = WebGPUStore
type Instance = WebGPUElement
type TextInstance = never
type SuspenseInstance = never
type HydratableInstance = never
type PublicInstance = WebGPUElement
type HostContext = null
type UpdatePayload = Record<string, unknown>
type ChildSet = never
type TimeoutHandle = number
type NoTimeout = -1

export const hostConfig: HostConfig<
  Type,
  Props,
  Container,
  Instance,
  TextInstance,
  SuspenseInstance,
  HydratableInstance,
  PublicInstance,
  HostContext,
  UpdatePayload,
  ChildSet,
  TimeoutHandle,
  NoTimeout
> = {
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,

  createInstance(
    type: Type,
    props: Props,
    rootContainer: Container,
    _hostContext: HostContext,
    _internalHandle: unknown,
  ): Instance {
    let instance: Document | Layer | ArtObject
    let element: WebGPUElement

    switch (type) {
      case 'document': {
        instance = createDocument({
          name: (props.name as string) || 'WebGPU Document',
        })
        element = createWebGPUElement('document', instance)
        rootContainer.documentState = instance
        break
      }

      case 'layer': {
        instance = createVectorLayer({
          name: (props.name as string) || 'Layer',
          visible: props.visible !== false,
          opacity: (props.opacity as number) ?? 1,
        })
        element = createWebGPUElement('layer', instance)
        break
      }

      case 'artObject': {
        instance = createPathArtObject({
          name: (props.name as string) || 'Art Object',
          layerId: props.layerId as string,
          x: (props.x as number) || 0,
          y: (props.y as number) || 0,
          path: (props.path as {
            points: Array<{ x: number; y: number }>
            closed: boolean
          }) || {
            points: [],
            closed: false,
          },
          appearances: (props.appearances as []) || [],
        })
        element = createWebGPUElement('artObject', instance)

        // Generate GPU data for art objects
        if (isPathArtObject(instance) && instance.path.points.length >= 3) {
          // Extract color from first fill appearance
          let color = { r: 1, g: 0, b: 0, a: 1 }
          if (props.color) {
            color = props.color as typeof color
          } else if (instance.appearances.length > 0) {
            const fillAppearance = instance.appearances.find(isFillAppearance)
            if (fillAppearance && fillAppearance.params.color) {
              color = fillAppearance.params.color
            }
          }

          const vertices = generateVerticesFromPath(instance.path, color)
          element.gpuData = {
            vertices,
            vertexCount: vertices.length / 6,
            isDirty: true,
          }
        }
        break
      }

      default:
        throw new Error(`Unknown element type: ${type}`)
    }

    return element
  },

  createTextInstance(): TextInstance {
    throw new Error('Text instances are not supported')
  },

  appendInitialChild(parent: Instance, child: Instance): void {
    parent.children.push(child)
    child.parent = parent

    // Update document structure
    if (parent.type === 'document' && child.type === 'layer') {
      addLayerToDocument(parent.instance as Document, child.instance as Layer)
    } else if (parent.type === 'layer' && child.type === 'artObject') {
      const document = parent.parent?.instance as Document
      if (document) {
        const artObject = child.instance as ArtObject
        artObject.layerId = (parent.instance as Layer).id
        addArtObjectToDocument(document, artObject)
      }
    }
  },

  appendChild(parent: Instance, child: Instance): void {
    parent.children.push(child)
    child.parent = parent

    if (parent.type === 'document' && child.type === 'layer') {
      addLayerToDocument(parent.instance as Document, child.instance as Layer)
    } else if (parent.type === 'layer' && child.type === 'artObject') {
      const document = parent.parent?.instance as Document
      if (document) {
        const artObject = child.instance as ArtObject
        artObject.layerId = (parent.instance as Layer).id
        addArtObjectToDocument(document, artObject)
      }
    }
  },

  appendChildToContainer(container: Container, child: Instance): void {
    if (child.type === 'document') {
      container.documentState = child.instance as Document
    }
  },

  removeChild(parent: Instance, child: Instance): void {
    const index = parent.children.indexOf(child)
    if (index > -1) {
      parent.children.splice(index, 1)
    }
    cleanupGPUResources(child)
  },

  removeChildFromContainer(container: Container, child: Instance): void {
    if (
      child.type === 'document' &&
      container.documentState === child.instance
    ) {
      container.documentState = null
    }
    cleanupGPUResources(child)
  },

  insertBefore(parent: Instance, child: Instance, beforeChild: Instance): void {
    const index = parent.children.indexOf(beforeChild)
    parent.children.splice(index, 0, child)
    child.parent = parent
  },

  commitUpdate(
    instance: Instance,
    _updatePayload: UpdatePayload,
    _type: Type,
    _oldProps: Props,
    newProps: Props,
    _rootContainer: Container,
  ): void {
    if (instance.type === 'artObject') {
      const artObject = instance.instance as ArtObject

      // Update position
      if (newProps.x !== undefined) {
        artObject.transform.x = newProps.x as number
        markElementDirty(instance)
      }
      if (newProps.y !== undefined) {
        artObject.transform.y = newProps.y as number
        markElementDirty(instance)
      }

      // Update color - need to regenerate vertices
      if (newProps.color && instance.gpuData) {
        const color = newProps.color as {
          r: number
          g: number
          b: number
          a: number
        }
        if (isPathArtObject(artObject)) {
          const vertices = generateVerticesFromPath(artObject.path, color)
          instance.gpuData.vertices = vertices
          instance.gpuData.vertexCount = vertices.length / 6
          markElementDirty(instance)
        }
      }
    }
  },

  commitTextUpdate(): void {
    throw new Error('Text updates are not supported')
  },

  clearContainer(container: Container): void {
    container.renderQueue = []
    container.documentState = null
  },

  prepareUpdate(
    _instance: Instance,
    _type: Type,
    _oldProps: Props,
    _newProps: Props,
    _rootContainer: Container,
    _hostContext: HostContext,
  ): UpdatePayload | null {
    return {}
  },

  shouldSetTextContent(): boolean {
    return false
  },

  getRootHostContext(): HostContext {
    return null
  },

  getChildHostContext(): HostContext {
    return null
  },

  getPublicInstance(instance: Instance): PublicInstance {
    return instance
  },

  prepareForCommit(): null {
    return null
  },

  resetAfterCommit(container: Container): void {
    // Find document root
    if (container.documentState) {
      const roots = Object.values((container as any).roots || {})
      if (roots.length > 0 && roots[0].current) {
        // rebuildRenderQueue(container, roots[0].current);
        // renderFrame(container);
      }
    }
  },

  preparePortalMount(): void {},

  finalizeInitialChildren(): boolean {
    return false
  },

  scheduleTimeout: setTimeout,
  cancelTimeout: clearTimeout,
  noTimeout: -1,
  isPrimaryRenderer: false,
  getCurrentEventPriority: () => 99,
  getInstanceFromNode: () => null,
  beforeActiveInstanceBlur: () => {},
  afterActiveInstanceBlur: () => {},
  prepareScopeUpdate: () => {},
  getInstanceFromScope: () => null,
  detachDeletedInstance: () => {},

  // Required reconciler functions
  now: Date.now,
  getCurrentUpdatePriority: () => 99,
  setCurrentUpdatePriority: () => {},
  resolveUpdatePriority: () => 99,
  requestUpdateLane: () => 1,

  // NotPendingTransition symbol
  NotPendingTransition: null,

  // Context
  HostTransitionContext: null,

  // Suspended state
  maySuspendCommit: () => false,
  startSuspendingCommit: () => {},
  suspendInstance: () => {},
  waitForCommitToBeReady: null,
  preloadInstance: () => null,

  // Form actions
  resetFormInstance: () => {},

  // Transition
  shouldAttemptEagerTransition: () => false,

  // Hidden
  isHidden: () => false,
  unhideInstance: () => {},
  hideInstance: () => {},
  hideTextInstance: () => {},
  unhideTextInstance: () => {},

  // Event
  requestPostPaintCallback: () => {},
  trackSchedulerEvent: () => {},
  resolveEventType: () => null,
  resolveEventTimeStamp: () => -1.1,
}
