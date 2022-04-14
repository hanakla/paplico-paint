import { setCanvasSize } from '../utils'
import {
  FilterContext,
  FilterInitializeContext,
  IFilter,
} from '../engine/IFilter'
import { WebGLContext } from '../engine/WebGLContext'
import { createContext2D } from '../Engine3_CanvasFactory'

// const SAMPLE_COUNT = 40
const quality = '4.0'

// From: https://www.shadertoy.com/view/Xltfzj
const FRAGMENT_SHADER_GAUSS = `
precision mediump float;

uniform sampler2D source;
uniform float   size;
uniform vec2    resolution;
varying vec2    vTexCoord;

const float Pi = 6.28318530718;
const float directions = 16.0;
const float quality = ${quality};

void main() {
  // float Pi = 6.28318530718; // Pi*2

  vec2 radius = 40.0 / resolution.xy;
  vec2 uv = vTexCoord;
  vec4 color = texture2D(source, vTexCoord);

  for(float d = 0.0; d < Pi; d += Pi / directions)
  {
    for(float i = 1.0 / quality; i<=1.0; i += 1.0 / quality)
    {
      color += texture2D(source, uv + vec2(cos(d), sin(d)) * radius * i);
    }
  }

  color /= quality * directions - 15.0;
  gl_FragColor = color;
  // gl_FragColor = texture2D(source, vTexCoord);
}
`

export class GaussBlurFilter implements IFilter {
  public static readonly id = '@silk-core/gauss-blur'

  public get id() {
    return GaussBlurFilter.id
  }

  public get initialConfig() {
    return { radius: 10, power: 200 }
  }

  private program: WebGLContext.ProgramSet | null = null

  public async initialize(ctx: FilterInitializeContext) {
    this.program = ctx.gl.createProgram(FRAGMENT_SHADER_GAUSS)
  }

  // private programHCache: { [rad: string]: WebGLContext.ProgramSet } = {}
  // private programVCache: { [rad: string]: WebGLContext.ProgramSet } = {}

  public async render({
    source,
    dest,
    gl,
    size,
    settings: { radius, power },
  }: FilterContext) {
    // const rad = Math.round(radius)

    // const programH = gl.createProgram(this.generateShader(rad, true))
    // const programV = gl.createProgram(this.generateShader(rad, false))

    const buffer = createContext2D()
    setCanvasSize(buffer.canvas, size.width, size.height)

    // const weights = this.generateWeight(rad, power)

    gl.applyProgram(
      this.program!,
      {
        // weight: gl.uni1fv(weights),
        size: gl.uni1f(radius),
        resolution: gl.uni2fv([size.width, size.height]),
      },
      source,
      buffer.canvas
    )

    gl.applyProgram(
      this.program!,
      {
        // weight: gl.uni1fv(weights),
        size: gl.uni1f(radius),
        resolution: gl.uni2fv([size.width, size.height]),
      },
      buffer.canvas,
      dest
    )

    // gl.applyProgram(
    //   programV,
    //   {
    //     weight: gl.uni1fv(weights),
    //     resolution: gl.uni2fv([size.width, size.height]),
    //   },
    //   buffer.canvas,
    //   dest
    // )
  }

  // private generateWeight(radius: number = 10, power: number = 200) {
  //   const weights: Array<number> = new Array(radius)

  //   let t = 0.0
  //   const d = power ** 2 / 100

  //   for (let i = 0; i < weights.length; i++) {
  //     const r = 1.0 + 2.0 * i

  //     let w = Math.exp((-0.5 * (r * r)) / d)
  //     weights[i] = w
  //     if (i > 0) {
  //       w *= 2.0
  //     }
  //     t += w
  //   }

  //   for (let i = 0; i < weights.length; i++) {
  //     weights[i] /= t
  //   }

  //   return weights
  // }

  // private generateShader(radius: number = 10, horizontal = false) {
  //   const indices = Array.from({ length: radius * 2 - 1 }).map(
  //     (_, idx) => idx - radius + 1
  //   )

  //   return `
  // precision mediump float;

  // uniform sampler2D source;
  // uniform vec2      resolution;
  // uniform float     weight[${radius}];
  // varying vec2      vTexCoord;

  // void main(void){
  //   float tFrag = 1.0 / resolution.x;
  //   vec4 destColor = vec4(0.0);

  //     ${
  //       horizontal
  //         ? `
  //           vec2 fc = vec2(gl_FragCoord.s, resolution.y - gl_FragCoord.t);

  //           ${indices
  //             .map(
  //               (i) =>
  //                 ` destColor += texture2D(source, (fc + vec2(${i}.0, 0.0)) * tFrag) * weight[${Math.abs(
  //                   i
  //                 )}];`
  //             )
  //             .join('\n')}
  //         `
  //         : `
  //         // vec2 fc = gl_FragCoord.st;
  //         vec2 fc = vec2(gl_FragCoord.s, resolution.y - gl_FragCoord.t);
  //         ${indices
  //           .map(
  //             (i) =>
  //               `destColor += texture2D(source, (fc + vec2(0.0, ${i}.0)) * tFrag) * weight[${Math.abs(
  //                 i
  //               )}];`
  //           )
  //           .join('\n')}
  //       `
  //     }

  //     gl_FragColor = destColor;
  //   }
  //   `
  // }
}
