// ZoomBlur port from pixi.js
// Copyright (c) 2013-2017 Mathew Groves, Chad Engler
// Licensed under the MIT License (MIT), see https://github.com/pixijs/filters/blob/main/LICENSE
//
// SEE: https://github.com/pixijs/filters/tree/main/filters/tilt-shift

import { logImage } from '../DebugHelper'
import { FilterContext, FilterInitContext, IFilter } from '../engine/IFilter'
import { WebGLContext } from '../engine/WebGLContext'
import { createContext2D } from '../Engine3_CanvasFactory'
import { setCanvasSize } from '../utils'
import { AbstractPixiFilterInterop } from './AbstractPixiFilterInterop'

declare namespace TiltShiftFilter {
  export type Params = {
    blur: number
    gradientBlur: number
    start: [number, number]
    end: [number, number]
  }
}

export class TiltShiftFilter extends AbstractPixiFilterInterop {
  public static readonly id = '@paplico/filters/tilt-shift'

  public get id() {
    return TiltShiftFilter.id
  }

  public get initialConfig(): TiltShiftFilter.Params {
    return {
      blur: 400,
      gradientBlur: 600,
      start: [0, 0],
      end: [1, 1],
    }
  }

  private program: WebGLContext.ProgramSet | null = null

  public async initialize({ gl }: FilterInitContext) {
    this.program = gl.createProgram(FRAGMENT_SHADER)
  }

  public async render(ctx: FilterContext<TiltShiftFilter.Params>) {
    const { gl, source, dest, settings, size } = ctx
    const buf = createContext2D()
    setCanvasSize(buf.canvas, size)

    const dx = settings.end[0] - settings.start[0]
    const dy = settings.end[1] - settings.start[1]
    const d = Math.sqrt(dx * dx + dy * dy)

    const commonUniforms = {
      blur: gl.uni1f(settings.blur),
      gradientBlur: gl.uni1f(settings.gradientBlur),
      start: gl.uni2fv(
        new Float32Array([
          size.width / settings.start[0],
          size.height / settings.start[1] / 2,
        ])
      ),
      end: gl.uni2fv(
        new Float32Array([
          size.height / settings.end[1],
          size.height / settings.end[1] / 2,
        ])
      ),
      texSize: gl.uni2fv([size.width, size.height]),
    }

    // X
    gl.applyProgram(
      this.program!,
      {
        ...this.getPixiUniforms(ctx),
        ...commonUniforms,
        delta: gl.uni2fv(new Float32Array([dx / d, dy / d])),
      },
      source,
      buf.canvas
    )

    // Y
    gl.applyProgram(
      this.program!,
      {
        ...this.getPixiUniforms(ctx),
        ...commonUniforms,
        delta: gl.uni2fv(new Float32Array([-dy / d, dx / d])),
      },
      buf.canvas,
      dest,
      { clear: true }
    )

    setCanvasSize(buf.canvas, 0, 0)
  }
}

export const FRAGMENT_SHADER = `
/*!
  Copyright (c) 2013-2017 Mathew Groves, Chad Engler
  Licensed under the MIT License (MIT), see https://github.com/pixijs/filters/blob/main/LICENSE
  Original from https://github.com/pixijs/filters/blob/main/filters/zoom-blur/src/zoom-blur.frag
*/

precision mediump float;

varying vec2 vUv;
uniform sampler2D source;

uniform float blur;
uniform float gradientBlur;
uniform vec2 start;
uniform vec2 end;
uniform vec2 delta;
uniform vec2 texSize;

float random(vec3 scale, float seed)
{
    return fract(sin(dot(gl_FragCoord.xyz + seed, scale)) * 43758.5453 + seed);
}

void main(void)
{
    vec4 color = vec4(0.0);
    float total = 0.0;

    float offset = random(vec3(12.9898, 78.233, 151.7182), 0.0);
    vec2 normal = normalize(vec2(start.y - end.y, end.x - start.x));
    float radius = smoothstep(0.0, 1.0, abs(dot(vUv * texSize - start, normal)) / gradientBlur) * blur;

    for (float t = -30.0; t <= 30.0; t++)
    {
        float percent = (t + offset - 0.5) / 30.0;
        float weight = 1.0 - abs(percent);
        vec4 sample = texture2D(source, vUv + delta / texSize * percent * radius);
        sample.rgb *= sample.a;
        color += sample * weight;
        total += weight;
    }

    color /= total;
    color.rgb /= color.a + 0.00001;

    gl_FragColor = color;
}
`
