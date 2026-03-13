import Reconciler from 'react-reconciler';
import { hostConfig } from './host-config';
import { initializeWebGPU } from './webgpu-store';
import type { WebGPUStore } from './webgpu-store';
import type React from 'react';

// Create the reconciler
export const webGPUReconciler = Reconciler(hostConfig);

// Export types
export type WebGPUContainer = ReturnType<typeof webGPUReconciler.createContainer>;

// Mount function
export async function mountWebGPUReconciler(canvas: HTMLCanvasElement) {
  // Initialize WebGPU
  const store = await initializeWebGPU(canvas);
  
  // Create container
  const container = webGPUReconciler.createContainer(
    store,
    0, // tag
    null, // hydration callbacks
    false, // isStrictMode
    false, // concurrentUpdatesByDefaultOverride
    '', // identifierPrefix
    () => {}, // onRecoverableError
    null // transitionCallbacks
  );
  
  // Store container reference for resetAfterCommit
  (store as any).roots = { default: container };
  
  return { container, store };
}

// Update container
export function updateWebGPUContainer(
  element: React.ReactElement,
  container: WebGPUContainer,
  callback?: () => void
): void {
  webGPUReconciler.updateContainer(element, container, null, callback || (() => {}));
}

// Unmount container
export function unmountWebGPUContainer(container: WebGPUContainer): void {
  webGPUReconciler.updateContainer(null, container, null, () => {});
}