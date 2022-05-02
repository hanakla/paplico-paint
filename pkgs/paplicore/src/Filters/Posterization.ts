import { FilterContext, IFilter } from '../engine/IFilter'
import { WebGLContext } from '../engine/WebGLContext'

// From: https://wgld.org/d/glsl/g007.html
const FRAGMENT_SHADER = `
  precision mediump float;

  varying vec2 vTexCoord;
  uniform sampler2D source;
  uniform float threshold;

  // from https://gist.github.com/companje/29408948f1e8be54dd5733a74ca49bb9
  float map(float value, float min1, float max1, float min2, float max2) {
    return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
  }

  float posterize(float value) {
    return map(value, 0.0);
  }

  void main() {
    vec4 color = texture2D(source, vTexCoord);
    vec3 postColor = vec3(

    );

    gl_FragColor = vec4(vec3(lightness), color.a);
  }
`

export class PosterizationFilter implements IFilter {
  public static readonly id = '@paplico/filters/posterization'

  public get id() {
    return PosterizationFilter.id
  }

  public get initialConfig() {
    return { threshold: 0.5 }
  }

  private program: WebGLContext.ProgramSet | null = null

  public async initialize({ gl }: { gl: WebGLContext }) {
    this.program = gl.createProgram(FRAGMENT_SHADER)
  }

  public async render({
    source,
    dest,
    gl,
    size,
    settings: { distance, angleDeg },
  }: FilterContext) {
    gl.applyProgram(this.program!, {}, source, dest)
  }
}
