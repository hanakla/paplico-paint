import { screenMix_func } from '../engine/Shaders'
import { FilterContext, IFilter } from '../engine/IFilter'
import { WebGLContext } from '../engine/WebGLContext'

export class ChromaticAberrationFilter implements IFilter {
  public static readonly id = '@paplico/filters/chromatic-aberration'

  public get id() {
    return ChromaticAberrationFilter.id
  }

  public get initialConfig() {
    return { distance: 10, angleDeg: 0 }
  }

  private program: WebGLContext.ProgramSet | null = null

  public async initialize({ gl }: { gl: WebGLContext }) {
    this.program = gl.createProgram(FRAGMENT_SHADER_RGB)
  }

  public async render({
    source,
    dest,
    gl,
    size,
    settings: { distance, angleDeg },
  }: FilterContext) {
    gl.applyProgram(
      this.program!,
      {
        resolution: gl.uni2f(size.width, size.height),
        distancePx: gl.uni1f(distance),
        angleRad: gl.uni1f(normalizeDegree(angleDeg) * (Math.PI / 180)),
      },
      source,
      dest,
    )
  }
}

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

  ${screenMix_func}

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
