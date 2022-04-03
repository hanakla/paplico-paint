import { assign } from '../utils'
import { FilterContext, IFilter } from '../engine/IFilter'
import { WebGLContext } from 'engine/WebGLContext'

const SAMPLE_COUNT = 40

// const FRAGMENT_SHADER_GAUSS = `
// precision mediump float;

// uniform sampler2D source;
// uniform float minBright;

// varying vec2 vTexCoord;

// void main() {
//     vec3 texel = max(vec3(0.0), (texture2D(source, vTexCoord) - minBright).rgb);
//     gl_FragColor = vec4(texel, texture2D(source, vTexCoord).a);
// }
// `

export class GaussBlurFilter implements IFilter {
  public static readonly id = '@silk-core/gauss-blur'

  public get id() {
    return GaussBlurFilter.id
  }

  public get initialConfig() {
    return { radius: 10, power: 200 }
  }

  public async initialize() {}

  private programHCache: { [rad: string]: WebGLContext.ProgramSet } = {}
  private programVCache: { [rad: string]: WebGLContext.ProgramSet } = {}

  public render({
    source,
    dest,
    gl,
    size,
    settings: { radius, power },
  }: FilterContext) {
    const rad = Math.round(radius)

    const programH = (this.programHCache[rad] =
      this.programHCache[rad] ??
      gl.createProgram(this.generateShader(rad, true)))

    const programV = (this.programVCache[rad] =
      this.programVCache[rad] ??
      gl.createProgram(this.generateShader(rad, false)))

    const buffer = assign(document.createElement('canvas')!, {
      width: size.width,
      height: size.height,
    }).getContext('2d')!

    const weights = this.generateWeight(rad, power)

    gl.applyProgram(
      programH,
      {
        weight: gl.uni1fv(weights),
        resolution: gl.uni2fv([size.width, size.height]),
      },
      source,
      buffer.canvas
    )
    gl.applyProgram(
      programV,
      {
        weight: gl.uni1fv(weights),
        resolution: gl.uni2fv([size.width, size.height]),
      },
      buffer.canvas,
      dest
    )
  }

  private generateWeight(radius: number = 10, power: number = 200) {
    const weights: Array<number> = new Array(radius)

    let t = 0.0
    const d = power ** 2 / 100

    for (let i = 0; i < weights.length; i++) {
      const r = 1.0 + 2.0 * i

      let w = Math.exp((-0.5 * (r * r)) / d)
      weights[i] = w
      if (i > 0) {
        w *= 2.0
      }
      t += w
    }

    for (let i = 0; i < weights.length; i++) {
      weights[i] /= t
    }

    return weights
  }

  private generateShader(radius: number = 10, horizontal = false) {
    const indices = Array.from({ length: radius * 2 - 1 }).map(
      (_, idx) => idx - radius + 1
    )

    return `
  precision mediump float;

  uniform sampler2D source;
  uniform vec2      resolution;
  uniform float     weight[${radius}];
  varying vec2      vTexCoord;

  void main(void){
    float tFrag = 1.0 / resolution.x;
    vec4 destColor = vec4(0.0);

      ${
        horizontal
          ? `
            vec2 fc = vec2(gl_FragCoord.s, resolution.y - gl_FragCoord.t);

            ${indices
              .map(
                (i) =>
                  ` destColor += texture2D(source, (fc + vec2(${i}.0, 0.0)) * tFrag) * weight[${Math.abs(
                    i
                  )}];`
              )
              .join('\n')}
          `
          : `
          // vec2 fc = gl_FragCoord.st;
          vec2 fc = vec2(gl_FragCoord.s, resolution.y - gl_FragCoord.t);
          ${indices
            .map(
              (i) =>
                `destColor += texture2D(source, (fc + vec2(0.0, ${i}.0)) * tFrag) * weight[${Math.abs(
                  i
                )}];`
            )
            .join('\n')}
        `
      }

      gl_FragColor = destColor;
    }
    `
  }
}
