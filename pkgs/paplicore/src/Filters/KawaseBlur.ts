// KawaseBlur port from pixi.js
// Copyright (c) 2013-2017 Mathew Groves, Chad Engler
// Licensed under the MIT License (MIT), see https://github.com/pixijs/filters/blob/main/LICENSE
//
// SEE: https://github.com/pixijs/filters/blob/main/filters/kawase-blur

import { logImage } from '../DebugHelper'
import { FilterContext, FilterInitContext, IFilter } from '../engine/IFilter'
import { WebGLContext } from '../engine/WebGLContext'
import { createContext2D } from '../Engine3_CanvasFactory'
import { setCanvasSize } from '../utils'
import { AbstractPixiFilterInterop } from './AbstractPixiFilterInterop'

declare namespace KawaseBlurFilter {
  export type Params = {
    blurSize: number
    quality: number
    pixelSize: [number, number]
  }
}

const QUALITY = 32

export class KawaseBlurFilter extends AbstractPixiFilterInterop {
  public static readonly id = '@paplico/filters/kawase-blur'

  public get id() {
    return KawaseBlurFilter.id
  }

  public get initialConfig(): KawaseBlurFilter.Params {
    return {
      blurSize: 10,
      // quality: 32,
      quality: 2,
      pixelSize: [1, 1],
    }
  }

  private program: WebGLContext.ProgramSet | null = null

  public async initialize({ gl }: FilterInitContext) {
    this.program = gl.createProgram(FRAGMENT_SHADER)
  }

  public async render(ctx: FilterContext<KawaseBlurFilter.Params>) {
    const { gl, size, source, dest, settings } = ctx
    settings.quality = Math.round(settings.quality)

    const uvX = settings.pixelSize[0] / size.width
    const uvY = settings.pixelSize[1] / size.height

    const kernels = this.generateKernels(settings)
    const input = createContext2D()
    setCanvasSize(input.canvas, size)
    input.drawImage(source, 0, 0)

    if (settings.quality === 1 || settings.blurSize === 0) {
      const offset = kernels[0] - 0.5

      gl.applyProgram(
        this.program!,
        {
          ...this.getPixiUniforms(ctx),
          uOffset: gl.uni2f(offset * uvX, offset * uvY),
        },
        input.canvas,
        dest
      )
    } else {
      const renderTarget = createContext2D()
      setCanvasSize(renderTarget.canvas, size)

      let bSource = input.canvas
      let bTarget = renderTarget.canvas

      let offset_: number
      const last = settings.quality - 1

      for (let i = 0; i < last; i++) {
        offset_ = kernels[i] - 0.5

        // SEE: https://github.com/pixijs/pixijs/blob/c63e917a/packages/core/src/filters/FilterSystem.ts#L439
        bTarget.getContext('2d')?.clearRect(0, 0, size.width, size.height)

        gl.applyProgram(
          this.program!,
          {
            ...this.getPixiUniforms(ctx),
            uOffset: gl.uni2fv(
              new Float32Array([offset_ * uvX, offset_ * uvY])
            ),
          },
          bSource,
          bTarget
        )

        console.group('hey')
        await logImage(bSource, 'bSource', { collapsed: false })
        await logImage(bTarget, 'bTarget', { collapsed: false })
        console.groupEnd()
        ;[bSource, bTarget] = [bTarget, bSource]
      }

      offset_ = kernels[last] - 0.5

      dest.getContext('2d')?.clearRect(0, 0, size.width, size.height)

      gl.applyProgram(
        this.program!,
        {
          ...this.getPixiUniforms(ctx),
          uOffset: gl.uni2fv(new Float32Array([offset_ * uvX, offset_ * uvY])),
        },
        bSource,
        dest
        // { sourceTexFilter: 'linear' }
      )

      // gl.applyProgram(
      //   this.program!,
      //   {
      //     ...this.getPixiUniforms(ctx),
      //     uOffset: gl.uni2fv(new Float32Array([0, 0])),
      //   },
      //   source,
      //   dest,
      //   { sourceTexFilter: 'nearest' }
      // )

      // console.log({ kernels })
    }
  }

  private generateKernels(settings: KawaseBlurFilter.Params) {
    const blur = settings.blurSize
    const quality = settings.quality
    const kernels: number[] = [blur]

    if (blur > 0) {
      let k = blur
      const step = blur / quality

      for (let i = 1; i < quality; i++) {
        k -= step
        kernels.push(k)
      }
    }

    return kernels
  }
}

export const FRAGMENT_SHADER = `
/*!
  Copyright (c) 2013-2017 Mathew Groves, Chad Engler
  Licensed under the MIT License (MIT), see https://github.com/pixijs/filters/blob/main/LICENSE
  Original from https://github.com/pixijs/filters/blob/main/filters/kawase-blur/src/kawase-blur-clamp.frag
*/

precision mediump float;

varying vec2 vUv;

uniform sampler2D source;
uniform vec2 uOffset;
uniform vec4 filterClamp;

vec4 clampedTex2D(sampler2D tex, vec2 uv) {
  return texture2D(tex, clamp(uv, filterClamp.xy, filterClamp.zw));
}

void main(void)
{
  vec4 color = vec4(0.0);

  // Sample top left pixel
  color += clampedTex2D(source, vUv - uOffset);

  // Sample top right pixel
  color += clampedTex2D(source, vUv + uOffset * vec2(1.0, -1.0));

  // Sample bottom right pixel
  color += clampedTex2D(source, vUv + uOffset);

  // Sample bottom left pixel
  color += clampedTex2D(source, vUv + uOffset * vec2(-1.0, 1.0));

  color *= 0.25;

  gl_FragColor = color;
  // gl_FragColor = clampedTex2D(source, vUv);
}
`
