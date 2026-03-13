import type { WebGPUStore, RenderCommand } from './webgpu-store';
import type { WebGPUElement } from './webgpu-element';
import { collectRenderableElements, isElementVisible, getLayerOpacity } from './webgpu-element';
import { create2DTransformMatrix } from './vertex-generator';
import type { ArtObject } from '@/engine/document';

export function rebuildRenderQueue(store: WebGPUStore, rootElement: WebGPUElement): void {
  // Clear existing render queue
  store.renderQueue = [];
  
  // Find document root
  let documentRoot = rootElement;
  while (documentRoot.parent) {
    documentRoot = documentRoot.parent;
  }
  
  // Collect all renderable elements
  const renderables = collectRenderableElements(documentRoot);
  
  // Build render commands
  for (const element of renderables) {
    if (!isElementVisible(element) || !element.gpuData) {
      continue;
    }
    
    const artObject = element.instance as ArtObject;
    
    // Create or update vertex buffer
    if (!element.gpuData.vertexBuffer || element.gpuData.isDirty) {
      if (element.gpuData.vertexBuffer) {
        element.gpuData.vertexBuffer.destroy();
      }
      
      element.gpuData.vertexBuffer = store.device.createBuffer({
        size: element.gpuData.vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
      
      store.device.queue.writeBuffer(
        element.gpuData.vertexBuffer,
        0,
        element.gpuData.vertices
      );
    }
    
    // Create or update transform buffer
    if (!element.gpuData.transformBuffer) {
      element.gpuData.transformBuffer = store.device.createBuffer({
        size: 64, // 4x4 matrix
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
    }
    
    // Update transform matrix
    const transform = create2DTransformMatrix(
      artObject.transform.x,
      artObject.transform.y,
      artObject.transform.rotation || 0,
      artObject.transform.scaleX || 1,
      artObject.transform.scaleY || 1,
      store.canvas.width,
      store.canvas.height
    );
    
    store.device.queue.writeBuffer(
      element.gpuData.transformBuffer,
      0,
      transform
    );
    
    // Create bind group
    if (!element.gpuData.transformBindGroup) {
      element.gpuData.transformBindGroup = store.device.createBindGroup({
        layout: store.bindGroupLayout,
        entries: [{
          binding: 0,
          resource: {
            buffer: element.gpuData.transformBuffer,
          },
        }],
      });
    }
    
    // Add to render queue
    store.renderQueue.push({
      vertexBuffer: element.gpuData.vertexBuffer,
      vertexCount: element.gpuData.vertexCount,
      transformBindGroup: element.gpuData.transformBindGroup,
      layerOpacity: getLayerOpacity(element),
    });
    
    element.gpuData.isDirty = false;
  }
}

export function renderFrame(store: WebGPUStore): void {
  if (!store.context || !store.device || store.renderQueue.length === 0) {
    return;
  }
  
  const commandEncoder = store.device.createCommandEncoder();
  
  const renderPassDescriptor: GPURenderPassDescriptor = {
    colorAttachments: [{
      view: store.context.getCurrentTexture().createView(),
      clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
      loadOp: 'clear',
      storeOp: 'store',
    }],
  };
  
  const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
  renderPass.setPipeline(store.renderPipeline);
  
  // Render each command
  for (const command of store.renderQueue) {
    renderPass.setVertexBuffer(0, command.vertexBuffer);
    renderPass.setBindGroup(0, command.transformBindGroup);
    renderPass.draw(command.vertexCount);
  }
  
  renderPass.end();
  store.device.queue.submit([commandEncoder.finish()]);
}

export function cleanupGPUResources(element: WebGPUElement): void {
  if (element.gpuData) {
    if (element.gpuData.vertexBuffer) {
      element.gpuData.vertexBuffer.destroy();
    }
    if (element.gpuData.transformBuffer) {
      element.gpuData.transformBuffer.destroy();
    }
  }
  
  // Cleanup children
  for (const child of element.children) {
    cleanupGPUResources(child);
  }
}