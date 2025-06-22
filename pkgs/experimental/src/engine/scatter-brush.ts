import type { EngineState, VectorPath } from './state'

export class ScatterBrushRenderer {
  private device: any
  private renderPipeline: any = null
  private instanceBuffer: any = null
  private uniformBuffer: any = null
  private bindGroup: any = null

  constructor(device: any) {
    this.device = device
    this.initialize()
  }

  private async initialize() {
    await this.createRenderPipeline()
    this.createUniformBuffer()
  }

  private async createRenderPipeline() {
    const vertexShaderCode = `
      struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) color: vec4<f32>,
        @location(1) uv: vec2<f32>,
      }

      struct Uniforms {
        viewMatrix: mat4x4<f32>,
        projectionMatrix: mat4x4<f32>,
      }

      struct InstanceData {
        position: vec2<f32>,
        size: f32,
        rotation: f32,
        color: vec4<f32>,
      }

      @group(0) @binding(0) var<uniform> uniforms: Uniforms;
      @group(0) @binding(1) var<storage, read> instances: array<InstanceData>;

      @vertex
      fn vs_main(
        @location(0) vertexPos: vec2<f32>,
        @location(1) uv: vec2<f32>,
        @builtin(instance_index) instanceIndex: u32
      ) -> VertexOutput {
        var output: VertexOutput;

        let instance = instances[instanceIndex];
        let cos_r = cos(instance.rotation);
        let sin_r = sin(instance.rotation);

        let rotatedPos = vec2<f32>(
          vertexPos.x * cos_r - vertexPos.y * sin_r,
          vertexPos.x * sin_r + vertexPos.y * cos_r
        );

        let scaledPos = rotatedPos * instance.size;
        let worldPos = vec4<f32>(scaledPos + instance.position, 0.0, 1.0);

        output.position = uniforms.projectionMatrix * uniforms.viewMatrix * worldPos;
        output.color = instance.color;
        output.uv = uv;

        return output;
      }
    `

    const fragmentShaderCode = `
      @fragment
      fn fs_main(@location(0) color: vec4<f32>, @location(1) uv: vec2<f32>) -> @location(0) vec4<f32> {
        let dist = length(uv - vec2<f32>(0.5, 0.5));
        var alpha: f32;
        if (dist < 0.5) {
          alpha = 1.0 - smoothstep(0.4, 0.5, dist);
        } else {
          alpha = 0.0;
        }
        return vec4<f32>(color.rgb, color.a * alpha);
      }
    `

    const vertexShader = this.device.createShaderModule({
      code: vertexShaderCode,
    })

    const fragmentShader = this.device.createShaderModule({
      code: fragmentShaderCode,
    })

    this.renderPipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: vertexShader,
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 4 * 4,
            attributes: [
              {
                shaderLocation: 0,
                offset: 0,
                format: 'float32x2',
              },
              {
                shaderLocation: 1,
                offset: 2 * 4,
                format: 'float32x2',
              },
            ],
          },
        ],
      },
      fragment: {
        module: fragmentShader,
        entryPoint: 'fs_main',
        targets: [
          {
            format: navigator.gpu.getPreferredCanvasFormat(),
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
              },
            },
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
      },
    })
  }

  private createUniformBuffer() {
    if (!this.renderPipeline) return

    this.uniformBuffer = this.device.createBuffer({
      size: 32 * 4,
      usage:
        (window as any).GPUBufferUsage?.UNIFORM |
          (window as any).GPUBufferUsage?.COPY_DST || 0x40 | 0x08,
    })

    this.bindGroup = this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.uniformBuffer,
          },
        },
      ],
    })
  }

  private createQuadVertexBuffer(): any {
    const vertices = new Float32Array([
      -0.5, -0.5, 0.0, 0.0, 0.5, -0.5, 1.0, 0.0, 0.5, 0.5, 1.0, 1.0, -0.5, -0.5,
      0.0, 0.0, 0.5, 0.5, 1.0, 1.0, -0.5, 0.5, 0.0, 1.0,
    ])

    const vertexBuffer = this.device.createBuffer({
      size: vertices.byteLength,
      usage:
        (window as any).GPUBufferUsage?.VERTEX |
          (window as any).GPUBufferUsage?.COPY_DST || 0x04 | 0x08,
    })

    this.device.queue.writeBuffer(vertexBuffer, 0, vertices)
    return vertexBuffer
  }

  generateScatterInstances(
    path: VectorPath,
    engineState: EngineState,
  ): Float32Array {
    const { scatterConfig } = engineState.strokeSettings
    if (!scatterConfig) return new Float32Array()

    const instances: number[] = []

    for (let i = 0; i < path.points.length - 1; i++) {
      const p1 = path.points[i]
      const p2 = path.points[i + 1]

      const dx = p2.x - p1.x
      const dy = p2.y - p1.y
      const segmentLength = Math.sqrt(dx * dx + dy * dy)

      if (segmentLength === 0) continue

      const numInstances = Math.max(
        1,
        Math.floor(segmentLength / (scatterConfig.spread || 10)),
      )

      for (let j = 0; j < numInstances; j++) {
        const t = j / Math.max(1, numInstances - 1)
        const baseX = p1.x + dx * t
        const baseY = p1.y + dy * t

        for (let k = 0; k < scatterConfig.count; k++) {
          const offsetX = (Math.random() - 0.5) * scatterConfig.spread
          const offsetY = (Math.random() - 0.5) * scatterConfig.spread

          const x = baseX + offsetX
          const y = baseY + offsetY

          const sizeVariation =
            1 + (Math.random() - 0.5) * (scatterConfig.sizeVariation || 0)
          const size = engineState.strokeSettings.size * sizeVariation

          const rotation = Math.random() * Math.PI * 2

          const opacityVariation =
            1 + (Math.random() - 0.5) * (scatterConfig.opacityVariation || 0)
          const opacity = Math.max(
            0,
            Math.min(1, engineState.strokeSettings.color.a * opacityVariation),
          )

          instances.push(
            x,
            y,
            size,
            rotation,
            engineState.strokeSettings.color.r,
            engineState.strokeSettings.color.g,
            engineState.strokeSettings.color.b,
            opacity,
          )
        }
      }
    }

    return new Float32Array(instances)
  }

  render(renderPass: any, path: VectorPath, engineState: EngineState) {
    if (!this.renderPipeline || !this.bindGroup) return

    const instanceData = this.generateScatterInstances(path, engineState)
    if (instanceData.length === 0) return

    const instanceBuffer = this.device.createBuffer({
      size: instanceData.byteLength,
      usage:
        (window as any).GPUBufferUsage?.STORAGE |
          (window as any).GPUBufferUsage?.COPY_DST || 0x80 | 0x08,
    })

    this.device.queue.writeBuffer(instanceBuffer, 0, instanceData)

    const bindGroup = this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.uniformBuffer!,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: instanceBuffer,
          },
        },
      ],
    })

    const vertexBuffer = this.createQuadVertexBuffer()
    const instanceCount = instanceData.length / 8

    renderPass.setPipeline(this.renderPipeline)
    renderPass.setBindGroup(0, bindGroup)
    renderPass.setVertexBuffer(0, vertexBuffer)
    renderPass.draw(6, instanceCount)

    vertexBuffer.destroy()
    instanceBuffer.destroy()
  }

  updateUniforms(viewMatrix: Float32Array, projectionMatrix: Float32Array) {
    if (!this.uniformBuffer) return

    const uniformData = new Float32Array(32)
    uniformData.set(viewMatrix, 0)
    uniformData.set(projectionMatrix, 16)

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData)
  }

  destroy() {
    this.instanceBuffer?.destroy()
    this.uniformBuffer?.destroy()
  }
}
