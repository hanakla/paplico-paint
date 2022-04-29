import { FilterContext, IFilter } from '../engine/IFilter'
import { WebGLContext } from '../engine/WebGLContext'

// From: https://wgld.org/d/glsl/g007.html
const FRAGMENT_SHADER = `
  precision mediump float;

  varying vec2 vTexCoord;
  uniform vec2 resolution;
  uniform sampler2D source;

  uniform float levelX;
  uniform float levelY;

  float posterize(float value, float level) {
    return (floor(value * level) / level) + (1.0 / (level * 2.0));
  }

  void main() {
    gl_FragColor = texture2D(
      source,
      vec2(
        posterize(vTexCoord.x, levelX),
        posterize(vTexCoord.y, levelY)
      )
    );
  }
`

export class LowResoFilter implements IFilter {
  public static readonly id = '@paplico/filters/low-reso'

  public get id() {
    return LowResoFilter.id
  }

  public get initialConfig() {
    return {
      sameBlocks: true,
      levelX: 16,
      levelY: 16,
    }
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
    settings: { sameBlocks, levelX, levelY },
  }: FilterContext) {
    gl.applyProgram(
      this.program!,
      {
        resolution: gl.uni2fv([size.width, size.height]),
        levelX: gl.uni1f(sameBlocks ? levelX : levelX),
        levelY: gl.uni1f(sameBlocks ? levelX : levelY),
      },
      source,
      dest
    )
  }
}
