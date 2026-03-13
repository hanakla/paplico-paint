import type { Document } from '@/engine/document';

export interface RenderCommand {
  vertexBuffer: GPUBuffer;
  vertexCount: number;
  transformBindGroup: GPUBindGroup;
  layerOpacity: number;
}

export interface WebGPUStore {
  canvas: HTMLCanvasElement;
  device: GPUDevice;
  context: GPUCanvasContext;
  renderPipeline: GPURenderPipeline;
  vertexBuffer: GPUBuffer | null;
  renderQueue: RenderCommand[];
  documentState: Document | null;
  bindGroupLayout: GPUBindGroupLayout;
}

export async function initializeWebGPU(canvas: HTMLCanvasElement): Promise<WebGPUStore> {
  // Check WebGPU support
  if (!navigator.gpu) {
    throw new Error('WebGPU is not supported in this browser');
  }

  // Get adapter and device
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error('Failed to get WebGPU adapter');
  }

  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu');
  if (!context) {
    throw new Error('Failed to get WebGPU context');
  }

  // Configure context
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format,
    alphaMode: 'premultiplied',
  });

  // Create bind group layout for transform matrix
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [{
      binding: 0,
      visibility: GPUShaderStage.VERTEX,
      buffer: { type: 'uniform' },
    }],
  });

  // Create pipeline layout
  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  });

  // Import shaders
  const { vertexShaderCode, fragmentShaderCode } = await import('./shaders');

  // Create shader modules
  const vertexShaderModule = device.createShaderModule({
    code: vertexShaderCode,
  });

  const fragmentShaderModule = device.createShaderModule({
    code: fragmentShaderCode,
  });

  // Create render pipeline
  const renderPipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: {
      module: vertexShaderModule,
      entryPoint: 'vs_main',
      buffers: [{
        arrayStride: 6 * 4, // 2 floats for position + 4 floats for color
        attributes: [
          {
            format: 'float32x2',
            offset: 0,
            shaderLocation: 0, // position
          },
          {
            format: 'float32x4',
            offset: 2 * 4,
            shaderLocation: 1, // color
          },
        ],
      }],
    },
    fragment: {
      module: fragmentShaderModule,
      entryPoint: 'fs_main',
      targets: [{
        format,
        blend: {
          color: {
            srcFactor: 'src-alpha',
            dstFactor: 'one-minus-src-alpha',
            operation: 'add',
          },
          alpha: {
            srcFactor: 'one',
            dstFactor: 'one-minus-src-alpha',
            operation: 'add',
          },
        },
      }],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });

  return {
    canvas,
    device,
    context,
    renderPipeline,
    vertexBuffer: null,
    renderQueue: [],
    documentState: null,
    bindGroupLayout,
  };
}