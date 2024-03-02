import { createFilter, PplcFilter } from '@/index-ext-filter'
import { RenderPipeline } from '..'
import { createContext2D } from '@/Infra/CanvasFactory'
import { saveAndRestoreCanvas, setCanvasSize } from '@/utils/canvas'

export namespace KawaseBlur {
  export type Setting = {
    blurSize: number
    quality: number
    pixelSize: [number, number]
  }
}

export const KawaseBlur = createFilter(
  class KawaseBlur extends PplcFilter.AbstractPixiFilterInterop<KawaseBlur.Setting> {
    public static readonly metadata: PplcFilter.FilterMetadata = {
      id: '@paplico/filters/pixi-blur',
      version: '0.0.1',
      name: 'Pixi Blur',
    }

    public static getInitialSetting(): KawaseBlur.Setting {
      return { blurSize: 10, quality: 10, pixelSize: [1, 1] }
    }

    public static migrateSetting(prevVersion: string, setting: any) {
      return setting
    }

    public static renderPane({}: PplcFilter.FilterPaneContext<KawaseBlur.Setting>) {
      return null
    }

    protected program: PplcFilter.GL.PPLCFilterProgram | null = null

    public get id() {
      return KawaseBlur.metadata.id
    }

    public async initialize(ctx: PplcFilter.FilterInitContext) {
      this.program = ctx.gl.createProgram(FRAGMENT_SHADER)
    }

    public async applyRasterFilter(
      input: PplcFilter.GL.InputSource,
      output: CanvasRenderingContext2D,
      ctx: PplcFilter.RasterFilterContext<KawaseBlur.Setting>,
    ): Promise<void> {
      const { gl, destSize, settings } = ctx
      settings.quality = Math.round(settings.quality)

      const uvX = settings.pixelSize[0] / destSize.width
      const uvY = settings.pixelSize[1] / destSize.height

      const kernels = this.generateKernels(settings)
      const buf = createContext2D()
      setCanvasSize(buf.canvas, destSize)

      buf.drawImage(input, 0, 0)
      output.clearRect(0, 0, destSize.width, destSize.height)

      if (settings.quality === 1 || settings.blurSize === 0) {
        const offset = kernels[0] - 0.5

        gl.apply(buf.canvas, output, this.program!, {
          ...this.getPixiUniforms(ctx),
          uOffset: gl.uni('2f', [offset * uvX, offset * uvY]),
        })
      } else {
        const renderTarget = createContext2D()
        setCanvasSize(renderTarget.canvas, destSize)

        let bSource = input.canvas
        let bTarget = renderTarget.canvas

        let offset_: number
        const last = settings.quality - 1

        for (let i = 0; i < last; i++) {
          offset_ = kernels[i] + 0.5

          // SEE: https://github.com/pixijs/pixijs/blob/c63e917a/packages/core/src/filters/FilterSystem.ts#L439
          bTarget
            .getContext('2d')
            ?.clearRect(0, 0, destSize.width, destSize.height)

          gl.apply(bSource, renderTarget, this.program!, {
            ...this.getPixiUniforms(ctx),
            uOffset: gl.uni(
              '2fv',
              new Float32Array([offset_ * uvX, offset_ * uvY]),
            ),
          })

          // await logImage(bTarget)
          ;[bSource, bTarget] = [bTarget, bSource]
        }

        offset_ = kernels[last] + 0.5

        gl.apply(bSource, output, this.program!, {
          ...this.getPixiUniforms(ctx),
          uOffset: gl.uni(
            '2fv',
            new Float32Array([offset_ * uvX, offset_ * uvY]),
          ),
          uClipping: gl.uni('1f', 1),
        })

        // await logImage(bSource)

        saveAndRestoreCanvas(output, () => {
          output.clearRect(0, 0, destSize.width, destSize.height)
          output!.drawImage(bSource, 0, 0)
        })
      }
    }

    private generateKernels(settings: KawaseBlur.Setting) {
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
  },
)

export const FRAGMENT_SHADER = `
/*!
  Copyright (c) 2013-2017 Mathew Groves, Chad Engler
  Licensed under the MIT License (MIT), see https://github.com/pixijs/filters/blob/main/LICENSE
  Original from https://github.com/pixijs/filters/blob/main/filters/kawase-blur/src/kawase-blur-clamp.frag
*/

precision highp float;

varying vec2 vUv;

uniform sampler2D source;
uniform vec2 uOffset;
uniform vec4 filterClamp;

vec4 clampedTex2D(sampler2D tex, vec2 uv) {
  return texture2D(tex, clamp(uv, filterClamp.xy, filterClamp.zw));
}

void main(void)
{
  vec4 color = vec4(0.0, 0.0, 0.0, 0.0);

  // Sample top left pixel
  color += clampedTex2D(source, vUv - uOffset);

  // Sample top right pixel
  color += clampedTex2D(source, vUv + uOffset * vec2(1.0, -1.0)) ;

  // Sample bottom right pixel
  color += clampedTex2D(source, vUv + uOffset);

  // Sample bottom left pixel
  color += clampedTex2D(source, vUv + uOffset * vec2(-1.0, 1.0));

  color *= 0.25;

  // vec4 sColor = texture2D(source, vUv);
  // vec4 cc = (sColor + sColor + sColor + sColor) *.1;
  // gl_FragColor = vec4(cc.r, cc.g, cc.b, cc.a);

  // color.a *= .25;

  // gl_FragColor = vec4(cc.r, cc.g, cc.b, cc.a);

  gl_FragColor = color;
  // gl_FragColor = (texture2D(source, vUv) + texture2D(source, vUv + vec2(-.02, .02))) * 0.5;
  // gl_FragColor = (color * 4.) + vec4(1. * texture2D(source, vUv).a,0.,0., texture2D(source, vUv).a);
  // gl_FragColor = texture2D(source, vUv);
  // gl_FragColor = vec4(sColor.r, sColor.g, sColor.b, vUv.y);

  // vec3 sourceColor = texture2D(source, vUv).rgb;
  // gl_FragColor = vec4(sourceColor.r, sourceColor.g, sourceColor.b, step(.5, texture2D(source, vUv).a) * .1);
  // gl_FragColor = vec4(1., 1., 1., step(.5, texture2D(source, vUv).a) * .2);
  // gl_FragColor = vec4(1., 1., 1., step(.5, texture2D(source, vUv).a) * .6);
}
`
