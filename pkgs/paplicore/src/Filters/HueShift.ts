// Outline port from pixi.js
// SEE: https://github.com/pixijs/filters/blob/main/filters/outline

import { FilterContext, FilterInitContext, IFilter } from '../engine/IFilter'
import { WebGLContext } from '../engine/WebGLContext'

declare namespace HueShiftFilter {
  export type Params = {
    colorSpace: 'hsv' | 'yiq'
    /** 0..1 */
    shift: number
  }
}

export class HueShiftFilter implements IFilter {
  public static readonly id = '@paplico/filters/hue-shift'

  public get id() {
    return HueShiftFilter.id
  }

  public get initialConfig(): HueShiftFilter.Params {
    return {
      colorSpace: 'hsv',
      shift: 0,
    }
  }

  private programHsv!: WebGLContext.ProgramSet
  private programYiq!: WebGLContext.ProgramSet

  public async initialize({ gl }: FilterInitContext) {
    this.programHsv = gl.createProgram(HSV_FRAG)
    this.programYiq = gl.createProgram(YIQ_FRAG)
  }

  public async render({ gl, source, dest, size, settings }: FilterContext) {
    const program =
      settings.colorSpace === 'hsv' ? this.programHsv : this.programYiq

    gl.applyProgram(
      program,
      {
        uHueShift: gl.uni1f(settings.shift),
      },
      source,
      dest,
      { clear: true }
    )
  }
}

export const HSV_FRAG = `
precision mediump float;

varying vec2 vUv;

uniform float uHueShift;
uniform sampler2D source;

const float PI = 3.1415926535;

// https://qiita.com/kitasenjudesign/items/c8ba019f26d644db34a8
vec3 rgb2hsv(vec3 c)
{
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c)
{
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main(){
    vec4 color = texture2D(source, vUv);

    vec3 hsv = rgb2hsv(color.rgb);
    hsv.r += uHueShift;
    vec3 rgb = hsv2rgb(hsv);

    gl_FragColor = vec4(rgb.r, rgb.g, rgb.b, color.a);
}
`

export const YIQ_FRAG = `
precision mediump float;

varying vec2 vUv;

uniform float uHueShift;
uniform sampler2D source;

const float PI = 3.1415926535;

// http://stackoverflow.com/a/9234854/1477002
vec3 hueShiftYIQ(vec3 color, float hueShift) {
    const vec3  kRGBToYPrime = vec3 (0.299, 0.587, 0.114);
    const vec3  kRGBToI     = vec3 (0.596, -0.275, -0.321);
    const vec3  kRGBToQ     = vec3 (0.212, -0.523, 0.311);

    const vec3  kYIQToR   = vec3 (1.0, 0.956, 0.621);
    const vec3  kYIQToG   = vec3 (1.0, -0.272, -0.647);
    const vec3  kYIQToB   = vec3 (1.0, -1.107, 1.704);

    float   YPrime  = dot (color, kRGBToYPrime);
    float   I      = dot (color, kRGBToI);
    float   Q      = dot (color, kRGBToQ);

    // Calculate the hue and chroma
    float   hue     = atan (Q, I);
    float   chroma  = sqrt (I * I + Q * Q);

    hue += hueShift;

    // Convert back to YIQ
    Q = chroma * sin (hue);
    I = chroma * cos (hue);

    // Convert back to RGB
    vec3    yIQ   = vec3 (YPrime, I, Q);
    color.r = dot (yIQ, kYIQToR);
    color.g = dot (yIQ, kYIQToG);
    color.b = dot (yIQ, kYIQToB);

    return color;
}

void main(){
  vec4 color = texture2D(source, vUv);
  vec3 rgb = hueShiftYIQ(color.rgb, -(uHueShift) * 2.0 * PI);
  gl_FragColor = vec4(rgb.r, rgb.g, rgb.b, color.a);
}
`
