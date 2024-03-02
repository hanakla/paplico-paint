// ZoomBlur port from pixi.js
// Copyright (c) 2013-2017 Mathew Groves, Chad Engler
// Licensed under the MIT License (MIT), see https://github.com/pixijs/filters/blob/main/LICENSE
//
// SEE: https://github.com/pixijs/filters/tree/main/filters/zoom-blur

import { logImage } from '@/utils/DebugHelper'
// import { WebGLContext } from '@/Engine/'
import {
  FilterInitContext,
  IFilter,
  createFilter,
} from '@/Engine/Filter/Filter'
import { PplcFilter } from '..'

declare namespace ZoomBlurFilter {
  export type State = {
    strength: number
    /** 0..1 */
    center: [number, number]
    innerRadius: number
    radius: number
  }
}

export const ZoomBlurFilter = createFilter<ZoomBlurFilter.State>(
  class ZoomBlurFilter extends AbsdtractPixiFilterInterop {
    public static readonly id = '@paplico/filters/zoom-blur'
    public static readonly version = '0.0.1'
    public static readonly apparanceName = 'Zoom Blur'

    public static get initialConfig(): ZoomBlurFilter.State {
      return {
        strength: 0.5,
        center: [0.5, 0.5],
        innerRadius: 0,
        radius: -1,
      }
    }

    public static renderPane({
      c,
      h,
      state,
      setState,
    }: PplcFilter.PaneContext<ZoomBlurFilter.State>) {
      const onStrengthChange = (value: number) => {
        setState({ strength: value / 100 })
      }

      const onCenterXChange = (value: number) => {
        setState((prev) => ({ ...prev, center: [value / 100, prev.center[1]] }))
      }

      const onCenterYChange = (value: number) => {
        setState((prev) => ({ ...prev, center: [prev.center[0], value / 100] }))
      }

      return h(c.View, {}, [
        h(c.View, { flexFlow: 'column' }, [
          h(c.View, { flexFlow: 'column' }, [
            h(c.Text, {}, 'Strength'),
            h(c.Slider, {
              min: 1,
              max: 100,
              step: 1,
              value: state.strength * 100,
              onChange: onStrengthChange,
            }),

            h(c.Text, {}, 'Center X'),
            h(c.Slider, {
              min: 0,
              max: 100,
              step: 0.01,
              value: state.center[0] * 100,
              onChange: onCenterXChange,
            }),

            h(c.Text, {}, 'Center Y'),
            h(c.Slider, {
              min: 0,
              max: 100,
              step: 0.001,
              value: state.center[1] * 100,
              onChange: onCenterYChange,
            }),
          ]),
        ]),
      ])
    }

    public get id() {
      return ZoomBlurFilter.id
    }

    private program: PplcFilter.PPLCFilterProgram | null = null

    public async initialize({ gl }: FilterInitContext) {
      this.program = gl.createProgram(FRAGMENT_SHADER)
    }

    public async render(ctx: FilterContext<ZoomBlurFilter.State>) {
      const { gl, source, dest, settings, size } = ctx

      gl.applyProgram(
        this.program!,
        {
          ...this.getPixiUniforms(ctx),
          uCenter: gl.uni2fv([
            settings.center[0] * size.width,
            settings.center[1] * size.height,
          ]),
          // uCenter: gl.uni2fv([settings.center[0], settings.center[1]]),
          uStrength: gl.uni1f(settings.strength),
          uInnerRadius: gl.uni1f(settings.innerRadius),
          uRadius: gl.uni1f(-1),
        },
        source,
        dest,
        { clear: true },
      )

      await logImage(dest, 'dest')
    }
  },
)

const maxKernelSize = '32.0'

export const FRAGMENT_SHADER = `
/*!
  Copyright (c) 2013-2017 Mathew Groves, Chad Engler
  Licensed under the MIT License (MIT), see https://github.com/pixijs/filters/blob/main/LICENSE
  Original from https://github.com/pixijs/filters/blob/main/filters/zoom-blur/src/zoom-blur.frag
*/

precision mediump float;

varying vec2 vUv;
uniform sampler2D source;
uniform vec4 filterArea;

uniform vec2 uCenter;
uniform float uStrength;
uniform float uInnerRadius;
uniform float uRadius;

const float MAX_KERNEL_SIZE = ${maxKernelSize};

// author: http://byteblacksmith.com/improvements-to-the-canonical-one-liner-glsl-rand-for-opengl-es-2-0/
highp float rand(vec2 co, float seed) {
    const highp float a = 12.9898, b = 78.233, c = 43758.5453;
    highp float dt = dot(co + seed, vec2(a, b)), sn = mod(dt, 3.14159);
    return fract(sin(sn) * c + seed);
}

void main() {

    float minGradient = uInnerRadius * 0.3;
    float innerRadius = (uInnerRadius + minGradient * 0.5) / filterArea.x;

    float gradient = uRadius * 0.3;
    float radius = (uRadius - gradient * 0.5) / filterArea.x;

    float countLimit = MAX_KERNEL_SIZE;

    vec2 dir = vec2(uCenter.xy / filterArea.xy - vUv);
    float dist = length(vec2(dir.x, dir.y * filterArea.y / filterArea.x));

    float strength = uStrength;

    float delta = 0.0;
    float gap;
    if (dist < innerRadius) {
        delta = innerRadius - dist;
        gap = minGradient;
    } else if (radius >= 0.0 && dist > radius) { // radius < 0 means it's infinity
        delta = dist - radius;
        gap = gradient;
    }

    if (delta > 0.0) {
        float normalCount = gap / filterArea.x;
        delta = (normalCount - delta) / normalCount;
        countLimit *= delta;
        strength *= delta;
        if (countLimit < 1.0)
        {
            gl_FragColor = texture2D(source, vUv);
            return;
        }
    }

    // randomize the lookup values to hide the fixed number of samples
    float offset = rand(vUv, 0.0);

    float total = 0.0;
    vec4 color = vec4(0.0);

    dir *= strength;

    for (float t = 0.0; t < MAX_KERNEL_SIZE; t++) {
        float percent = (t + offset) / MAX_KERNEL_SIZE;
        float weight = 4.0 * (percent - percent * percent);
        vec2 p = vUv + dir * percent;
        vec4 sample = texture2D(source, p);

        // switch to pre-multiplied alpha to correctly blur transparent images
        // sample.rgb *= sample.a;

        color += sample * weight;
        total += weight;

        if (t > countLimit){
            break;
        }
    }

    color /= total;
    // switch back from pre-multiplied alpha
    // color.rgb /= color.a + 0.00001;

    gl_FragColor = color;
}
`
