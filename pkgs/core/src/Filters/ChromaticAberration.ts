import { screenMix_func } from '@/Engine/Filter/fragmentShaders'
import { PplcFilter, createFilter } from '@/index-ext-filter'

export namespace ChromaticAberration {
  export type Settings = {
    distance: number
    angleDeg: number
  }
}

export const ChromaticAberration = createFilter(
  class ChromaticAberration
    implements PplcFilter.IFilter<ChromaticAberration.Settings>
  {
    public static readonly metadata: PplcFilter.FilterMetadata = {
      id: '@paplico/core/filters/ChromaticAberration',
      version: '0.0.1',
      name: 'Chromatic Aberration',
    }

    public static getInitialSetting() {
      return { distance: 10, angleDeg: 0 }
    }

    public static migrateSetting(
      prevVersion: string,
      config: ChromaticAberration.Settings,
    ) {
      return config
    }

    public static renderPane({
      h,
      c,
      settings,
      setSettings,
    }: PplcFilter.FilterPaneContext<ChromaticAberration.Settings>) {
      const onChangeDistance = (value: number) => {
        setSettings({ ...settings, distance: value })
      }

      return h(
        c.View,
        { flexFlow: 'column' },
        h(c.FieldSet, {
          title: 'Distance',
          inputs: h(c.Slider, {
            min: 0,
            max: 1000,
            step: 0.1,
            value: settings.distance,
            onChange: onChangeDistance,
          }),
          // displayValue: settings.distance.toString(),
        }),
      )
    }

    public get id() {
      return ChromaticAberration.metadata.id
    }

    private program: PplcFilter.GL.PPLCFilterProgram | null = null

    public async initialize({ gl }: PplcFilter.FilterInitContext) {
      this.program = gl.createProgram(FRAGMENT_SHADER_RGB)
    }

    public async applyRasterFilter(
      input: PplcFilter.FilterInputSource,
      output: CanvasRenderingContext2D,
      {
        gl,
        settings: filterSetting,
        settings: { distance, angleDeg },
        destSize,
      }: PplcFilter.RasterFilterContext<ChromaticAberration.Settings>,
    ) {
      // console.time('ChromaticAberration')

      gl.apply(input, output, this.program!, {
        resolution: gl.uni('2f', [destSize.width, destSize.height]),
        distancePx: gl.uni('1f', [distance]),
        angleRad: gl.uni('1f', [normalizeDegree(angleDeg) * (Math.PI / 180)]),
      })

      // console.timeEnd('ChromaticAberration')
    }
  },
)

const normalizeDegree = (deg: number) => {
  const norm = deg % 360
  return norm < 0 ? norm + 360 : norm
}

const FRAGMENT_SHADER_RGB = `
  precision mediump float;

  uniform sampler2D source;
  uniform float distancePx;
  uniform float angleRad;
  uniform vec2 resolution;

  varying vec2 vUv;

  ${screenMix_func('screenMix')}

  void main() {
    vec2 tFrag = vec2(1.0) / resolution;
    vec2 movement = vec2(
      cos(angleRad) * (distancePx * tFrag.x),
      sin(angleRad) * (distancePx * tFrag.y)
    );

    vec4 r = texture2D(source, vUv + movement) * vec4(1, 0, 0, 1);
    vec4 g = texture2D(source, vUv) * vec4(0, 1, 0, 1);
    vec4 b = texture2D(source, vUv + -movement) * vec4(0, 0, 1, 1);

    gl_FragColor = screenMix(screenMix(r, g), b);
    // gl_FragColor = vec4(0,0,0,0);
  }
`

// const FRAGMENT_SHADER_CMYK = `
//   precision mediump float;

//   uniform sampler2D source;
//   uniform float distancePx;
//   uniform float angleRad;
//   uniform vec2 resolution;

//   varying vec2 vUv;

//   ${screenMix_func}

//   // SEE: https://www.rapidtables.com/convert/color/rgb-to-cmyk.html
//   vec4 rgbToCmyk(vec4 rgba) {
//     float k = 1.0 - max(max(rgba.r, rgba.g), rgba.b);
//     float c = (1.0 - rgba.r - k) / (1.0 - k);
//     float m = (1.0 - rgba.g - k) / (1.0 - k);
//     float y = (1.0 - rgba.b - k) / (1.0 - k);

//     return vec4(c, m, y, k);
//   }

//   vec3 cmykToRgb(vec4 cmyk) {
//     // r = c, b = m, g = y, a = k

//     return vec3(
//       (1.0 - cmyk.r) * (1.0 - cmyk.a),
//       (1.0 - cmyk.g) * (1.0 - cmyk.a),
//       (1.0 - cmyk.b) * (1.0 - cmyk.a),
//     );
//   }

//   void main() {
//     vec2 tFrag = vec2(1.0) / resolution;
//     vec2 movement = vec2(
//       cos(angleRad) * (distancePx * tFrag.x),
//       sin(angleRad) * (distancePx * tFrag.y)
//     );

//     vec4 c = rgbToCmyk(texture2D(source, vUv + movement));
//     vec4 m = rgbToCmyk(texture2D(source, vUv - movement));
//     vec4 y = rgbToCmyk(texture2D(source, vUv - movement));

//     vec4 r = texture2D(source, vUv + movement) * vec4(1, 0, 0, 1);
//     vec4 g = texture2D(source, vUv) * vec4(0, 1, 0, 1);
//     vec4 b = texture2D(source, vUv + -movement) * vec4(0, 0, 1, 1);

//     gl_FragColor = screenMix(screenMix(r, g), b);
//   }
// `
