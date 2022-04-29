import { screenMix_func } from '../engine/Shaders'
import { FilterContext, IFilter } from '../engine/IFilter'
import { WebGLContext } from '../engine/WebGLContext'

// From: https://wgld.org/d/glsl/g007.html
const FRAGMENT_SHADER = `
  precision mediump float;
  uniform float time;

  const int   oct  = 8;
  const float per  = 0.5;
  const float PI   = 3.1415926;
  const float cCorners = 1.0 / 16.0;
  const float cSides   = 1.0 / 8.0;
  const float cCenter  = 1.0 / 4.0;

  // 補間関数
  float interpolate(float a, float b, float x){
      float f = (1.0 - cos(x * PI)) * 0.5;
      return a * (1.0 - f) + b * f;
  }

  // 乱数生成
  float rnd(vec2 p){
      return fract(sin(dot(p ,vec2(12.9898,78.233))) * 43758.5453);
  }

  // 補間乱数
  float irnd(vec2 p){
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec4 v = vec4(rnd(vec2(i.x,       i.y      )),
                    rnd(vec2(i.x + 1.0, i.y      )),
                    rnd(vec2(i.x,       i.y + 1.0)),
                    rnd(vec2(i.x + 1.0, i.y + 1.0)));
      return interpolate(interpolate(v.x, v.y, f.x), interpolate(v.z, v.w, f.x), f.y);
  }

  // ノイズ生成
  float noise(vec2 p){
      float t = 0.0;
      for(int i = 0; i < oct; i++){
          float freq = pow(2.0, float(i));
          float amp  = pow(per, float(oct - i));
          t += irnd(vec2(p.x / freq, p.y / freq)) * amp;
      }
      return t;
  }

  // シームレスノイズ生成
  float snoise(vec2 p, vec2 q, vec2 r){
      return noise(vec2(p.x,       p.y      )) *        q.x  *        q.y  +
            noise(vec2(p.x,       p.y + r.y)) *        q.x  * (1.0 - q.y) +
            noise(vec2(p.x + r.x, p.y      )) * (1.0 - q.x) *        q.y  +
            noise(vec2(p.x + r.x, p.y + r.y)) * (1.0 - q.x) * (1.0 - q.y);
  }

  void main(void){
    // // noise
    vec2 t = gl_FragCoord.xy + vec2(time * 10.0);
    float n = noise(t);

    // seamless noise
  	// const float map = 256.0;
  	// vec2 t = mod(gl_FragCoord.xy + vec2(time * 10.0), map);
  	// float n = snoise(t, t / map, vec2(map));

    gl_FragColor = vec4(vec3(n), 1.0);
    // gl_FragColor = vec4(, 1.0);
  }
`

export class NoiseFilter implements IFilter {
  public static readonly id = '@paplico/filters/noise'

  public get id() {
    return NoiseFilter.id
  }

  public get initialConfig() {
    return { distance: 10, angleDeg: 0 }
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
    gl.applyProgram(
      this.program!,
      {
        time: gl.uni1f(1),
      },
      source,
      dest
    )
  }
}
