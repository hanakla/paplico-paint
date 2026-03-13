import type { FilterConfig } from './state';

export class FilterRenderer {
  private device: any;
  private filterPipelines: Map<string, any> = new Map();
  private uniformBuffer: any = null;
  private sampler: any = null;

  constructor(device: any) {
    this.device = device;
    this.initialize();
  }

  private async initialize() {
    await this.createFilterPipelines();
    this.createUniformBuffer();
    this.createSampler();
  }

  private createSampler() {
    this.sampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });
  }

  private createUniformBuffer() {
    this.uniformBuffer = this.device.createBuffer({
      size: 16 * 4,
      usage:
        (window as any).GPUBufferUsage?.UNIFORM |
          (window as any).GPUBufferUsage?.COPY_DST || 0x40 | 0x08,
    });
  }

  private async createFilterPipelines() {
    const vertexShaderCode = `
      struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) uv: vec2<f32>,
      }

      @vertex
      fn vs_main(@location(0) position: vec2<f32>) -> VertexOutput {
        var output: VertexOutput;
        output.position = vec4<f32>(position, 0.0, 1.0);
        output.uv = position * 0.5 + 0.5;
        output.uv.y = 1.0 - output.uv.y;
        return output;
      }
    `;

    const blurFragmentShader = `
      @group(0) @binding(0) var inputTexture: texture_2d<f32>;
      @group(0) @binding(1) var inputSampler: sampler;
      @group(0) @binding(2) var<uniform> params: vec4<f32>;

      @fragment
      fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
        let blurRadius = params.x;
        let texelSize = 1.0 / vec2<f32>(textureDimensions(inputTexture));

        var color = vec4<f32>(0.0);
        var totalWeight = 0.0;

        for (var x = -4; x <= 4; x++) {
          for (var y = -4; y <= 4; y++) {
            let offset = vec2<f32>(f32(x), f32(y)) * texelSize * blurRadius;
            let weight = exp(-0.5 * (f32(x * x + y * y)) / (blurRadius * blurRadius));
            color += textureSample(inputTexture, inputSampler, uv + offset) * weight;
            totalWeight += weight;
          }
        }

        return color / totalWeight;
      }
    `;

    const brightnessFragmentShader = `
      @group(0) @binding(0) var inputTexture: texture_2d<f32>;
      @group(0) @binding(1) var inputSampler: sampler;
      @group(0) @binding(2) var<uniform> params: vec4<f32>;

      @fragment
      fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
        let brightness = params.x;
        let color = textureSample(inputTexture, inputSampler, uv);
        return vec4<f32>(color.rgb + brightness, color.a);
      }
    `;

    const contrastFragmentShader = `
      @group(0) @binding(0) var inputTexture: texture_2d<f32>;
      @group(0) @binding(1) var inputSampler: sampler;
      @group(0) @binding(2) var<uniform> params: vec4<f32>;

      @fragment
      fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
        let contrast = params.x;
        let color = textureSample(inputTexture, inputSampler, uv);
        let adjustedColor = (color.rgb - 0.5) * contrast + 0.5;
        return vec4<f32>(adjustedColor, color.a);
      }
    `;

    const saturationFragmentShader = `
      @group(0) @binding(0) var inputTexture: texture_2d<f32>;
      @group(0) @binding(1) var inputSampler: sampler;
      @group(0) @binding(2) var<uniform> params: vec4<f32>;

      @fragment
      fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
        let saturation = params.x;
        let color = textureSample(inputTexture, inputSampler, uv);
        let gray = dot(color.rgb, vec3<f32>(0.299, 0.587, 0.114));
        let adjustedColor = mix(vec3<f32>(gray), color.rgb, saturation);
        return vec4<f32>(adjustedColor, color.a);
      }
    `;

    const hueFragmentShader = `
      @group(0) @binding(0) var inputTexture: texture_2d<f32>;
      @group(0) @binding(1) var inputSampler: sampler;
      @group(0) @binding(2) var<uniform> params: vec4<f32>;

      fn rgb2hsv(c: vec3<f32>) -> vec3<f32> {
        let K = vec4<f32>(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
        let p = mix(vec4<f32>(c.bg, K.wz), vec4<f32>(c.gb, K.xy), step(c.b, c.g));
        let q = mix(vec4<f32>(p.xyw, c.r), vec4<f32>(c.r, p.yzx), step(p.x, c.r));
        let d = q.x - min(q.w, q.y);
        let e = 1.0e-10;
        return vec3<f32>(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
      }

      fn hsv2rgb(c: vec3<f32>) -> vec3<f32> {
        let K = vec4<f32>(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        let p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, vec3<f32>(0.0), vec3<f32>(1.0)), c.y);
      }

      @fragment
      fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
        let hueShift = params.x;
        let color = textureSample(inputTexture, inputSampler, uv);
        let hsv = rgb2hsv(color.rgb);
        let adjustedHsv = vec3<f32>(fract(hsv.x + hueShift), hsv.y, hsv.z);
        let adjustedColor = hsv2rgb(adjustedHsv);
        return vec4<f32>(adjustedColor, color.a);
      }
    `;

    const vertexShader = this.device.createShaderModule({
      code: vertexShaderCode,
    });

    const filterShaders = {
      blur: blurFragmentShader,
      brightness: brightnessFragmentShader,
      contrast: contrastFragmentShader,
      saturation: saturationFragmentShader,
      hue: hueFragmentShader,
    };

    for (const [filterType, fragmentCode] of Object.entries(filterShaders)) {
      const fragmentShader = this.device.createShaderModule({
        code: fragmentCode,
      });

      const pipeline = this.device.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module: vertexShader,
          entryPoint: 'vs_main',
          buffers: [
            {
              arrayStride: 2 * 4,
              attributes: [
                {
                  shaderLocation: 0,
                  offset: 0,
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
            },
          ],
        },
        primitive: {
          topology: 'triangle-list',
        },
      });

      this.filterPipelines.set(filterType, pipeline);
    }
  }

  private createQuadVertexBuffer(): GPUBuffer {
    const vertices = new Float32Array([
      -1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1,
    ]);

    const vertexBuffer = this.device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    this.device.queue.writeBuffer(vertexBuffer, 0, vertices);
    return vertexBuffer;
  }

  applyFilters(inputTexture: any, outputTexture: any, filters: FilterConfig[]) {
    if (!this.uniformBuffer || !this.sampler) return;

    let currentInput = inputTexture;
    let currentOutput = outputTexture;

    for (let i = 0; i < filters.length; i++) {
      const filter = filters[i];
      if (!filter.enabled) continue;

      const pipeline = this.filterPipelines.get(filter.type);
      if (!pipeline) continue;

      const params = new Float32Array(4);
      if (filter.type === 'blur') {
        params[0] = filter.params.radius || 1.0;
      } else if (filter.type === 'brightness') {
        params[0] = filter.params.brightness || 0.0;
      } else if (filter.type === 'contrast') {
        params[0] = filter.params.contrast || 1.0;
      } else if (filter.type === 'saturation') {
        params[0] = filter.params.saturation || 1.0;
      } else if (filter.type === 'hue') {
        params[0] = filter.params.hue || 0.0;
      }

      this.device.queue.writeBuffer(this.uniformBuffer, 0, params);

      const bindGroup = this.device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: currentInput.createView(),
          },
          {
            binding: 1,
            resource: this.sampler,
          },
          {
            binding: 2,
            resource: {
              buffer: this.uniformBuffer,
            },
          },
        ],
      });

      const commandEncoder = this.device.createCommandEncoder();
      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: currentOutput.createView(),
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
          },
        ],
      });

      const vertexBuffer = this.createQuadVertexBuffer();

      renderPass.setPipeline(pipeline);
      renderPass.setBindGroup(0, bindGroup);
      renderPass.setVertexBuffer(0, vertexBuffer);
      renderPass.draw(6);
      renderPass.end();

      this.device.queue.submit([commandEncoder.finish()]);

      vertexBuffer.destroy();

      if (i < filters.length - 1) {
        const tempTexture = this.device.createTexture({
          size: [currentOutput.width, currentOutput.height],
          format: navigator.gpu.getPreferredCanvasFormat(),
          usage:
            GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        });
        currentInput = currentOutput;
        currentOutput = tempTexture;
      }
    }
  }

  destroy() {
    this.uniformBuffer?.destroy();
    this.filterPipelines.clear();
  }
}
