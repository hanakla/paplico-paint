import { FilterContext, IFilter } from '../engine/IFilter'
import { WebGLContext } from '../engine/WebGLContext'
import { clamp } from 'ag-psd/dist/helpers'

export declare namespace NoiseFilter {
  export type Params = {
    scale: number
    color: boolean
    seed: number
  }
}
export class NoiseFilter implements IFilter {
  public static readonly id = '@paplico/filters/noise'

  public get id() {
    return NoiseFilter.id
  }

  public get initialConfig(): NoiseFilter.Params {
    return { scale: 1, color: true, seed: Math.round(Math.random() * 100000) }
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
    settings,
  }: FilterContext<NoiseFilter.Params>) {
    gl.applyProgram(
      this.program!,
      {
        time: gl.uni1f(settings.seed),
        resolution: gl.uni1fv([size.width, size.height]),
        useColor: gl.uni1f(settings.color ? 1 : 0),
      },
      source,
      dest,
      {
        outputSize: {
          width: clamp(Math.round(size.width / settings.scale), 1, 4096),
          height: clamp(Math.round(size.height / settings.scale), 1, 4096),
        },
      }
    )
  }
}

const HASHES = `
  // MIT License...
  /* Copyright (c)2014 David Hoskins.

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.*/

  //----------------------------------------------------------------------------------------
  //  1 out, 1 in...
  float hash11(float p)
  {
      p = fract(p * .1031);
      p *= p + 33.33;
      p *= p + p;
      return fract(p);
  }

  //----------------------------------------------------------------------------------------
  //  1 out, 2 in...
  float hash12(vec2 p)
  {
    vec3 p3  = fract(vec3(p.xyx) * .1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
  }

  //----------------------------------------------------------------------------------------
  //  1 out, 3 in...
  float hash13(vec3 p3)
  {
    p3  = fract(p3 * .1031);
      p3 += dot(p3, p3.zyx + 31.32);
      return fract((p3.x + p3.y) * p3.z);
  }

  //----------------------------------------------------------------------------------------
  //  2 out, 1 in...
  vec2 hash21(float p)
  {
    vec3 p3 = fract(vec3(p) * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.xx+p3.yz)*p3.zy);

  }

  //----------------------------------------------------------------------------------------
  ///  2 out, 2 in...
  vec2 hash22(vec2 p)
  {
    vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
      p3 += dot(p3, p3.yzx+33.33);
      return fract((p3.xx+p3.yz)*p3.zy);

  }

  //----------------------------------------------------------------------------------------
  ///  2 out, 3 in...
  vec2 hash23(vec3 p3)
  {
    p3 = fract(p3 * vec3(.1031, .1030, .0973));
      p3 += dot(p3, p3.yzx+33.33);
      return fract((p3.xx+p3.yz)*p3.zy);
  }

  //----------------------------------------------------------------------------------------
  //  3 out, 1 in...
  vec3 hash31(float p)
  {
    vec3 p3 = fract(vec3(p) * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yzx+33.33);
    return fract((p3.xxy+p3.yzz)*p3.zyx);
  }


  //----------------------------------------------------------------------------------------
  ///  3 out, 2 in...
  vec3 hash32(vec2 p)
  {
    vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
      p3 += dot(p3, p3.yxz+33.33);
      return fract((p3.xxy+p3.yzz)*p3.zyx);
  }

  //----------------------------------------------------------------------------------------
  ///  3 out, 3 in...
  vec3 hash33(vec3 p3)
  {
    p3 = fract(p3 * vec3(.1031, .1030, .0973));
      p3 += dot(p3, p3.yxz+33.33);
      return fract((p3.xxy + p3.yxx)*p3.zyx);

  }

  //----------------------------------------------------------------------------------------
  // 4 out, 1 in...
  vec4 hash41(float p)
  {
    vec4 p4 = fract(vec4(p) * vec4(.1031, .1030, .0973, .1099));
      p4 += dot(p4, p4.wzxy+33.33);
      return fract((p4.xxyz+p4.yzzw)*p4.zywx);

  }

  //----------------------------------------------------------------------------------------
  // 4 out, 2 in...
  vec4 hash42(vec2 p)
  {
    vec4 p4 = fract(vec4(p.xyxy) * vec4(.1031, .1030, .0973, .1099));
      p4 += dot(p4, p4.wzxy+33.33);
      return fract((p4.xxyz+p4.yzzw)*p4.zywx);

  }

  //----------------------------------------------------------------------------------------
  // 4 out, 3 in...
  vec4 hash43(vec3 p)
  {
    vec4 p4 = fract(vec4(p.xyzx)  * vec4(.1031, .1030, .0973, .1099));
      p4 += dot(p4, p4.wzxy+33.33);
      return fract((p4.xxyz+p4.yzzw)*p4.zywx);
  }

  //----------------------------------------------------------------------------------------
  // 4 out, 4 in...
  vec4 hash44(vec4 p4)
  {
    p4 = fract(p4  * vec4(.1031, .1030, .0973, .1099));
      p4 += dot(p4, p4.wzxy+33.33);
      return fract((p4.xxyz+p4.yzzw)*p4.zywx);
  }

  //----------------------------------------------------------------------------------------
  float hashOld12(vec2 p)
  {
      // Two typical hashes...
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);

      // This one is better, but it still stretches out quite quickly...
      // But it's really quite bad on my Mac(!)
      //return fract(sin(dot(p, vec2(1.0,113.0)))*43758.5453123);

  }

  vec3 hashOld33( vec3 p )
  {
    p = vec3( dot(p,vec3(127.1,311.7, 74.7)),
          dot(p,vec3(269.5,183.3,246.1)),
          dot(p,vec3(113.5,271.9,124.6)));

    return fract(sin(p)*43758.5453123);
  }
`

const FRAGMENT_SHADER = `
  precision mediump float;

  // Copyright (c) 2014 David Hoskins.
  // Licensed under the MIT License (MIT), see https://www.shadertoy.com/view/4djSRW

  uniform vec2 resolution;
  uniform float time;
  uniform float useColor;

  ${HASHES}

  void main(void) {
    vec2 position = gl_FragCoord.xy;

    float v = float(1.0) * .152;
    vec2 pos = (position * v + time * 1500. + 50.0);
    vec3 a = hash32(pos);

    vec3 col = a / vec3(1.0);
    // gl_FragColor = vec4(col, 1.0);


    gl_FragColor = mix(
      vec4(col.r, col.r, col.r, 1.0),
      vec4(col, 1.0),
      step(.5, useColor)
    );
  }
`
