import { FilterContext, FilterInitContext, IFilter } from '../engine/IFilter'
import { mirroredRepeat_func } from '../engine/Shaders'
import { WebGLContext } from '../engine/WebGLContext'

export declare namespace UVReplaceFilter {
  export type Params = {
    replacement: 'delta' | 'absolute'
    movementPx: [number, number]
    /**
     * Using red channel to X movement, green channel to Y movement.
     * 128 is no movement.
     */
    replaceMapLayerUid: string | null
    // clamping: 'repeat' | 'to-edge' | 'mirrored-repeat'
  }
}

export class UVReplaceFilter implements IFilter {
  public static readonly id = '@paplico/filters/uvreplace'

  public get id() {
    return UVReplaceFilter.id
  }

  public get initialConfig(): UVReplaceFilter.Params {
    return {
      replacement: 'delta',
      movementPx: [0, 0],
      replaceMapLayerUid: null,
      // clamping: 'repeat',
    }
  }

  private programDelta: WebGLContext.ProgramSet | null = null
  private programAbs: WebGLContext.ProgramSet | null = null

  public async initialize({ gl }: FilterInitContext) {
    this.programDelta = gl.createProgram(FRAGMENT_SHADER_DELTA)
    this.programAbs = gl.createProgram(FRAGMENT_SHADER_ABS)
  }

  public async render({
    gl,
    source,
    dest,
    size,
    requestLayerBitmap,
    settings,
  }: FilterContext<UVReplaceFilter.Params>) {
    settings = {
      ...this.initialConfig,
      ...settings,
    }

    if (!settings.replaceMapLayerUid) return

    const map = await requestLayerBitmap(settings.replaceMapLayerUid)
    if (map.missing) {
      console.warn(
        `UVReplaceFilter: Missing map layer ${settings.replaceMapLayerUid}`
      )
      return
    }

    const usingProgram =
      settings.replacement === 'delta' ? this.programDelta : this.programAbs

    gl.applyProgram(
      usingProgram!,
      {
        resolution: gl.uni2fv([size.width, size.height]),
        movementPx: gl.uni2fv(new Float32Array(settings.movementPx)),
        displacementMap: gl.uniTexture2D(map.image, {}),
      },
      source,
      dest
    )
  }
}

const FRAGMENT_SHADER_DELTA = `
precision mediump float;

varying vec2 vUv;
uniform vec2 movementPx;
uniform vec2 resolution;

uniform sampler2D source;
uniform sampler2D displacementMap;

float map(float value, float min1, float max1, float min2, float max2) {
  return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
}

void main() {

  vec2 pixelSize = vec2(1.0) / resolution;

  vec4 mapColor = texture2D(displacementMap, vUv);
  vec2 sampleVec = vec2(
    map(mapColor.r, 0.0, 1.0, -1.0, 1.0),
    map(mapColor.g, 0.0, 1.0, -1.0, 1.0)
  ) + pixelSize * vec2(.5);

  vec2 samplePos = vUv + (sampleVec * movementPx * pixelSize * vec2(mapColor.a));

  gl_FragColor = texture2D(source, samplePos);
  // gl_FragColor = texture2D(displacementMap, samplePos);
  // gl_FragColor = mapColor;
  // gl_FragColor = vec4(samplePos.x, samplePos.y, 0.0, 1.0);
}
`

const FRAGMENT_SHADER_ABS = `
precision mediump float;

varying vec2 vUv;
uniform vec2 movementPx;
uniform vec2 resolution;

uniform sampler2D source;
uniform sampler2D displacementMap;

void main() {
  vec4 samplePos = texture2D(displacementMap, vUv);
  gl_FragColor = texture2D(source, vec2(samplePos.r, samplePos.g)) * vec4(1.0, 1.0, 1.0, samplePos.a);
  // gl_FragColor = vec4(samplePos.x, samplePos.y, 0.0, 1.0);
}
`

// export const FRAGMENT_SHADER = `
// /*!
//   Copyright (c) 2013-2017 Mathew Groves, Chad Engler
//   Licensed under the MIT License (MIT), see https://github.com/pixijs/filters/blob/main/LICENSE
//   Original from https://github.com/pixijs/filters/blob/main/filters/outline/src/outline.frag
// */

// precision mediump float;

// varying vec2 vUv;
// uniform sampler2D source;

// uniform vec2 thickness;
// uniform vec4 outlineColor;
// // uniform vec4 filterClamp;

// const float DOUBLE_PI = 3.14159265358979323846264 * 2.;

// void main(void) {
//     vec4 ownColor = texture2D(source, vUv);
//     vec4 curColor;
//     float maxAlpha = 0.;

//     vec2 displaced;
//     for (float angle = 0.; angle <= DOUBLE_PI; angle += ${ANGLE_STEP}) {
//         displaced.x = vUv.x + thickness.x * cos(angle);
//         displaced.y = vUv.y + thickness.y * sin(angle);
//         // curColor = texture2D(source, clamp(displaced, filterClamp.xy, filterClamp.zw));
//         curColor = texture2D(source, displaced);
//         maxAlpha = max(maxAlpha, curColor.a);
//     }

//     float resultAlpha = max(maxAlpha, ownColor.a);
//     gl_FragColor = vec4((ownColor.rgb + outlineColor.rgb * (1. - ownColor.a)) * resultAlpha, resultAlpha);
//     // gl_FragColor = vec4(1, 1, 0, resultAlpha);
// }
// `
