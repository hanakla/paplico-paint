import { clamp } from 'three/src/math/MathUtils'
import { FilterContext, FilterInitContext, IFilter } from '../engine/IFilter'
import { WebGLContext } from '../engine/WebGLContext'
import { Color } from '../Value'

export class OutlineFilter implements IFilter {
  public static readonly id = '@paplico/filters/outline'

  public get id() {
    return OutlineFilter.id
  }

  public get initialConfig() {
    return {
      thickness: 2,
      color: { r: 0, g: 0, b: 0, a: 1 },
    }
  }

  private program: WebGLContext.ProgramSet | null = null
  // private composer: EffectComposer

  public async initialize({ gl }: FilterInitContext) {
    this.program = gl.createProgram(FRAGMENT_SHADER)
  }

  public async render({
    gl,
    threeRenderer,
    threeCamera,
    source,
    dest,
    size,
    settings: { thickness, color },
  }: FilterContext) {
    gl.applyProgram(
      this.program!,
      {
        thickness: gl.uni2f(thickness / size.width, thickness / size.height),
        outlineColor: gl.uni4f(color.r, color.g, color.b, color.a),
      },
      source,
      dest
    )
  }
}

const MAX_SAMPLES = 100
const MIN_SAMPLES = 1
const QUALITY = 0.4
const ANGLE_STEP = (
  (Math.PI * 2) /
  Math.max(QUALITY * MAX_SAMPLES, MIN_SAMPLES)
).toFixed(7)

export const FRAGMENT_SHADER = `
/*!
  Copyright (c) 2013-2017 Mathew Groves, Chad Engler
  Licensed under the MIT License (MIT), see https://github.com/pixijs/filters/blob/main/LICENSE
  Original from https://github.com/pixijs/filters/blob/main/filters/outline/src/outline.frag
*/

precision mediump float;

varying vec2 vUv;
uniform sampler2D source;

uniform vec2 thickness;
uniform vec4 outlineColor;
// uniform vec4 filterClamp;

const float DOUBLE_PI = 3.14159265358979323846264 * 2.;

void main(void) {
    vec4 ownColor = texture2D(source, vUv);
    vec4 curColor;
    float maxAlpha = 0.;

    vec2 displaced;
    for (float angle = 0.; angle <= DOUBLE_PI; angle += ${ANGLE_STEP}) {
        displaced.x = vUv.x + thickness.x * cos(angle);
        displaced.y = vUv.y + thickness.y * sin(angle);
        // curColor = texture2D(source, clamp(displaced, filterClamp.xy, filterClamp.zw));
        curColor = texture2D(source, displaced);
        maxAlpha = max(maxAlpha, curColor.a);
    }

    float resultAlpha = max(maxAlpha, ownColor.a);
    gl_FragColor = vec4((ownColor.rgb + outlineColor.rgb * (1. - ownColor.a)) * resultAlpha, resultAlpha);
    // gl_FragColor = vec4(1, 1, 0, resultAlpha);
}
`
