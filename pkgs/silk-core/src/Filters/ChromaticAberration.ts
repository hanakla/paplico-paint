import { screenMix_func } from '../engine/Shaders'
import { FilterContext, IFilter } from '../engine/IFilter'
import { WebGLContext } from '../engine/WebGLContext'

const FRAGMENT_SHADER = `
  precision mediump float;

  uniform sampler2D source;
  uniform float distancePx;
  uniform float angleRad;
  uniform vec2 resolution;

  varying vec2 vTexCoord;

  ${screenMix_func}

  void main() {
    vec2 tFrag = vec2(1.0) / resolution;
    vec2 movement = vec2(
      cos(angleRad) * (distancePx * tFrag.x),
      sin(angleRad) * (distancePx * tFrag.y)
    );

    vec4 r = texture2D(source, vTexCoord + movement) * vec4(1, 0, 0, 1);
    vec4 g = texture2D(source, vTexCoord) * vec4(0, 1, 0, 1);
    vec4 b = texture2D(source, vTexCoord + -movement) * vec4(0, 0, 1, 1);

    gl_FragColor = screenMix(screenMix(r, g), b);
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

  private program: WebGLContext.ProgramSet | null = null

  public async initialize({ gl }: { gl: WebGLContext }) {
    this.program = gl.createProgram(FRAGMENT_SHADER)
  }

  public render({
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
      dest
    )
  }
}

const normalizeDegree = (deg: number) => {
  const norm = deg % 360
  return norm < 0 ? norm + 360 : norm
}
