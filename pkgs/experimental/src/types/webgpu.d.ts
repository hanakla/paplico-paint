declare global {
  interface Navigator {
    gpu: GPU
  }

  interface GPU {
    requestAdapter(): Promise<GPUAdapter | null>
    getPreferredCanvasFormat(): string
  }

  interface GPUAdapter {
    requestDevice(): Promise<GPUDevice>
  }

  interface GPUDevice {
    createShaderModule(descriptor: any): any
    createRenderPipeline(descriptor: any): any
    createBuffer(descriptor: any): any
    createBindGroup(descriptor: any): any
    createCommandEncoder(): any
    createTexture(descriptor: any): any
    queue: any
    destroy(): void
  }

  interface GPUCanvasContext {
    configure(configuration: any): void
    getCurrentTexture(): any
  }

  interface HTMLCanvasElement {
    getContext(contextId: 'webgpu'): GPUCanvasContext | null
  }
}

export {}
