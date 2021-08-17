import { FilterContext, IFilter } from '../engine/IFilter'

const FRAGMENT_SHADER = `
  precision mediump float;

  uniform sampler2D source;
  uniform float distancePx;
  uniform vec2 resolution;

  varying vec2 vTexCoord;

  vec4 screen(vec4 fore, vec4 back) {
    // SEE: https://odashi.hatenablog.com/entry/20110921/1316610121

    float a1 = fore.a * back.a;
    float a2 = fore.a * (1.0 - back.a);
    float a3 = (1.0 - fore.a) * back.a;
    float alpha = a1 + a2 + a3;

    vec3 mixed = ((fore + back) - (fore * back)).rgb;
    vec3 result = (mixed * a1 + fore.rgb * a2 + back.rgb * a3) / alpha;

    return vec4(result, alpha);
  }

  void main() {
    vec2 tFrag = vec2(1.0) / resolution;
    vec2 movement = vec2(distancePx * tFrag.x, 0);

    vec4 r = texture2D(source, vTexCoord + vec2(distancePx * tFrag.x, 0)) * vec4(1, 0, 0, 1);
    vec4 g = texture2D(source, vTexCoord + vec2((distancePx * 1.5) * tFrag.x, 0)) * vec4(0, 1, 0, 1);
    vec4 b = texture2D(source, vTexCoord + vec2((distancePx * 2.0) * tFrag.x, 0)) * vec4(0, 0, 1, 1);

    gl_FragColor = screen(screen(r, g), b);
    // gl_FragColor = screen(r, g);
  }
`

export class ChromaticAberrationFilter implements IFilter {
  public static readonly id = '@silk-core/chromatic-aberration'

  public get id() {
    return ChromaticAberrationFilter.id
  }

  public get initialConfig() {
    return { distance: 10, angleDeg: 0 }
  }

  public async initialize() {}
  public render({
    source,
    dest,
    gl,
    size,
    settings: { distance, angleDeg },
  }: FilterContext) {
    const program = gl.createProgram(FRAGMENT_SHADER)

    gl.applyProgram(
      program,
      {
        resolution: gl.uni2f(size.width, size.height),
        distancePx: gl.uni1f(distance),
        angleDeg: gl.uni1f(angleDeg),
      },
      source,
      dest
    )
  }
}
