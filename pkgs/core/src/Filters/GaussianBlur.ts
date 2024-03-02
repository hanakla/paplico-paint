import { PplcFilter, createFilter } from '@/index-ext-filter'

// From: https://www.shadertoy.com/view/Xltfzj
const FRAGMENT_SHADER_GAUSS = `
precision mediump float;

uniform sampler2D uSource;
uniform float   radius;
uniform vec2    resolution;
varying vec2    vUv;

// ガウシアン関数
float gaussian(float x, float sigma) {
  return exp(-(x * x) / (2.0 * sigma * sigma)) / (2.0 * 3.1415 * sigma * sigma);
}

void main() {
  vec4 color = vec4(0.0);
  float total = 0.0;
  float sigma = radius / 3.0;

  // for (float x = -radius; x <= radius; x++) {
  //   for (float y = -radius; y <= radius; y++) {
  //     vec2 offset = vec2(x, y) / resolution;
  //     float weight = gaussian(length(vec2(x, y)), sigma);
  //     vec4 sample = texture2D(uSource, vUv + offset);

  //     color += sample * weight;
  //     total += weight;
  //   }
  // }

  // gl_FragColor = color / total;
  gl_FragColor = color;
}
`

export const GaussianBlur = createFilter(
  class GaussianBlur implements PplcFilter.IFilter<any> {
    public static readonly metadata: PplcFilter.FilterMetadata = {
      id: '@paplico/filters/gaussian-blur',
      version: '0.0.1',
      name: 'Gaussian Blur',
    }

    public get id() {
      return GaussianBlur.metadata.id
    }

    public static getInitialSetting() {
      return { radius: 40 }
    }

    public static migrateSetting(prevVersion: string, setting: any) {
      return setting
    }

    public static renderPane({
      h,
      c,
      setSettings,
      settings,
    }: PplcFilter.FilterPaneContext<
      ReturnType<typeof GaussianBlur.getInitialSetting>
    >) {
      const onChangeRadius = (value: number) => {
        setSettings({ ...settings, radius: value })
      }

      return h(
        c.View,
        {
          flexFlow: 'column',
        },
        h(c.FieldSet, {
          title: 'Radius',
          inputs: h(c.Slider, {
            min: 0,
            max: 100,
            step: 1,
            value: settings.radius,
            onChange: onChangeRadius,
          }),
        }),
      )
    }

    private program: PplcFilter.GL.PPLCFilterProgram | null = null

    public async initialize(ctx: PplcFilter.FilterInitContext) {
      this.program = ctx.gl.createProgram(FRAGMENT_SHADER_GAUSS)
    }

    // private programHCache: { [rad: string]: WebGLContext.ProgramSet } = {}
    // private programVCache: { [rad: string]: WebGLContext.ProgramSet } = {}

    public async applyRasterFilter(
      input: PplcFilter.GL.InputSource,
      output: CanvasRenderingContext2D,
      {
        destSize,
        gl,
        pixelRatio,
        settings: { radius, power },
      }: PplcFilter.RasterFilterContext<any>,
    ) {
      // const rad = Math.round(radius)

      // const programH = gl.createProgram(this.generateShader(rad, true))
      // const programV = gl.createProgram(this.generateShader(rad, false))

      // const buffer = createContext2D()
      // setCanvasSize(buffer.canvas, destSize.width, destSize.height)

      // const weights = this.generateWeight(rad, power)

      const target = gl.createRenderTarget(destSize.width, destSize.height)

      // gl.apply(input, target, this.program!, {
      //   radius: gl.uni('1f', [radius]),
      //   resolution: gl.uni('2fv', [destSize.width, destSize.height]),
      // })

      // gl.apply(target, output, this.program!, {
      //   radius: gl.uni('1f', [radius]),
      //   resolution: gl.uni('2fv', [destSize.width, destSize.height]),
      // })

      gl.apply(input, output, this.program!, {
        radius: gl.uni('1f', [radius]),
        resolution: gl.uni('2fv', [destSize.width, destSize.height]),
      })

      // gl.applyProgram(
      //   programV,
      //   {
      //     weight: gl.uni1fv(weights),
      //     resolution: gl.uni2fv([destSize.width, destSize.height]),
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
  },
)
