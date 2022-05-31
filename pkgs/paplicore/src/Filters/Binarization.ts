import { FilterContext, IFilter } from '../engine/IFilter'
import { WebGLContext } from '../engine/WebGLContext'

const FRAGMENT_SHADER = `
  precision mediump float;

  varying vec2 vTexCoord;
  uniform sampler2D source;
  uniform float level;

  const float redScale   = 0.298912;
  const float greenScale = 0.586611;
  const float blueScale  = 0.114478;
  const vec3 monochromeScale = vec3(redScale, greenScale, blueScale);

  float posterize(float value) {
    return (floor(value * level) / level) + (1.0 / (level * 2.0));
  }

  void main() {
    vec4 color = texture2D(source, vTexCoord);
    vec3 postColor = vec3(
      posterize(color.r),
      posterize(color.g),
      posterize(color.b)
    );

    // float lightness = step(threshold, dot(postColor.rgb, monochromeScale));
    // gl_FragColor = vec4(vec3(lightness), color.a);
    gl_FragColor = vec4(postColor, color.a);
  }
`

export class BinarizationFilter implements IFilter {
  public static readonly id = '@paplico/filters/binarization'

  public get id() {
    return BinarizationFilter.id
  }

  public get initialConfig() {
    return { level: 2 }
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
    settings: { level },
  }: FilterContext) {
    console.log({ level })
    gl.applyProgram(
      this.program!,
      {
        level: gl.uni1f(level),
      },
      source,
      dest
    )
  }
}
