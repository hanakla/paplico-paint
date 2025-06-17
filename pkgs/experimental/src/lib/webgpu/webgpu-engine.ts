export class WebGPUEngine {
  private device: GPUDevice | null = null
  private context: GPUCanvasContext | null = null
  private canvas: HTMLCanvasElement | null = null
  private renderPipeline: GPURenderPipeline | null = null
  private format: GPUTextureFormat = 'bgra8unorm'

  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    if (!navigator.gpu) {
      throw new Error('WebGPU is not supported in this browser')
    }

    this.canvas = canvas
    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter) {
      throw new Error('Failed to get WebGPU adapter')
    }

    this.device = await adapter.requestDevice()
    this.context = canvas.getContext('webgpu')

    if (!this.context) {
      throw new Error('Failed to get WebGPU context')
    }

    this.format = navigator.gpu.getPreferredCanvasFormat() as GPUTextureFormat
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied',
    })

    await this.setupRenderPipeline()
  }

  private async setupRenderPipeline(): Promise<void> {
    if (!this.device) throw new Error('Device not initialized')

    const vertexShaderCode = /* wgsl */ `
      struct VertexOutput {
        @builtin(position) position: vec4f,
        @location(0) color: vec4f,
      }

      @vertex
      fn main(@location(0) position: vec2f, @location(1) color: vec4f) -> VertexOutput {
        var output: VertexOutput;
        output.position = vec4f(position, 0.0, 1.0);
        output.color = color;
        return output;
      }
    `

    const fragmentShaderCode = /* wgsl */ `
      @fragment
      fn main(@location(0) color: vec4f) -> @location(0) vec4f {
        return color;
      }
    `

    const vertexShaderModule = this.device.createShaderModule({
      code: vertexShaderCode,
    })

    const fragmentShaderModule = this.device.createShaderModule({
      code: fragmentShaderCode,
    })

    this.renderPipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: vertexShaderModule,
        entryPoint: 'main',
        buffers: [
          {
            arrayStride: 6 * 4,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' },
              { shaderLocation: 1, offset: 2 * 4, format: 'float32x4' },
            ],
          },
        ],
      },
      fragment: {
        module: fragmentShaderModule,
        entryPoint: 'main',
        targets: [{ format: this.format }],
      },
      primitive: {
        topology: 'triangle-list',
      },
    })
  }

  render(vertices: Float32Array): void {
    if (!this.device || !this.context || !this.renderPipeline) return

    const vertexBuffer = this.device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    })

    this.device.queue.writeBuffer(vertexBuffer, 0, vertices)

    const commandEncoder = this.device.createCommandEncoder()
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    })

    renderPass.setPipeline(this.renderPipeline)
    renderPass.setVertexBuffer(0, vertexBuffer)
    renderPass.draw(vertices.length / 6)
    renderPass.end()

    this.device.queue.submit([commandEncoder.finish()])
  }

  destroy(): void {
    this.device = null
    this.context = null
    this.canvas = null
    this.renderPipeline = null
  }
}
