import type { Document, Layer, ArtObject } from '@/engine/document';

export interface GPUData {
  vertices: Float32Array;
  vertexCount: number;
  vertexBuffer?: GPUBuffer;
  transformBuffer?: GPUBuffer;
  transformBindGroup?: GPUBindGroup;
  isDirty: boolean;
}

export interface WebGPUElement {
  type: 'document' | 'layer' | 'artObject';
  instance: Document | Layer | ArtObject;
  gpuData?: GPUData;
  children: WebGPUElement[];
  parent: WebGPUElement | null;
  needsUpdate: boolean;
}

export function createWebGPUElement(
  type: WebGPUElement['type'],
  instance: Document | Layer | ArtObject
): WebGPUElement {
  return {
    type,
    instance,
    gpuData: undefined,
    children: [],
    parent: null,
    needsUpdate: false,
  };
}

export function markElementDirty(element: WebGPUElement): void {
  element.needsUpdate = true;
  if (element.gpuData) {
    element.gpuData.isDirty = true;
  }
}

export function collectRenderableElements(
  element: WebGPUElement,
  renderables: WebGPUElement[] = []
): WebGPUElement[] {
  if (element.type === 'artObject' && element.gpuData) {
    renderables.push(element);
  }
  
  for (const child of element.children) {
    collectRenderableElements(child, renderables);
  }
  
  return renderables;
}

export function findDocumentRoot(element: WebGPUElement): WebGPUElement | null {
  let current: WebGPUElement | null = element;
  
  while (current) {
    if (current.type === 'document') {
      return current;
    }
    current = current.parent;
  }
  
  return null;
}

export function getLayerOpacity(element: WebGPUElement): number {
  let opacity = 1.0;
  let current: WebGPUElement | null = element;
  
  while (current) {
    if (current.type === 'layer') {
      const layer = current.instance as Layer;
      opacity *= layer.opacity ?? 1.0;
    }
    current = current.parent;
  }
  
  return opacity;
}

export function isElementVisible(element: WebGPUElement): boolean {
  let current: WebGPUElement | null = element;
  
  while (current) {
    if (current.type === 'layer') {
      const layer = current.instance as Layer;
      if (!layer.visible) {
        return false;
      }
    } else if (current.type === 'artObject') {
      const artObject = current.instance as ArtObject;
      if (!artObject.visible) {
        return false;
      }
    }
    current = current.parent;
  }
  
  return true;
}