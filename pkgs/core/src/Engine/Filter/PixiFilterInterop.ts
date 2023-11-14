import { RenderPipeline } from '../RenderPipeline'
import { FilterInitContext, IFilter, RasterFilterContext } from './Filter'

export abstract class AbstractPixiFilterInterop<T extends Record<string, any>>
  implements IFilter<T>
{
  abstract get id(): string

  abstract initialize({ gl }: FilterInitContext): Promise<void>

  abstract applyRasterFilter(
    input: RenderPipeline.CompositionImageSource,
    output: CanvasRenderingContext2D,
    ctx: RasterFilterContext<T>,
  ): Promise<void>
  protected getPixiUniforms({
    gl,
    destSize,
  }: RasterFilterContext<Record<string, any>>): any {
    const reso = 1

    // SEE: https://github.com/pixijs/pixijs/blob/c63e917/packages/core/src/filters/FilterSystem.ts#L274
    const uInputSize = new Float32Array([
      destSize.width,
      destSize.height,
      1.0 / destSize.width,
      1.0 / destSize.height,
    ])

    // SEE: https://github.com/pixijs/pixijs/blob/c63e917/packages/core/src/filters/FilterSystem.ts#L274
    const uInputPixel = new Float32Array([
      Math.round(destSize.width * reso),
      Math.round(destSize.height * reso),
      1 / Math.round(destSize.width * reso),
      1 / Math.round(destSize.height * reso),
    ])

    // SEE: https://github.com/pixijs/pixijs/blob/c63e917/packages/core/src/filters/FilterSystem.ts#L279
    const uInputClamp = new Float32Array([
      0.5 * uInputPixel[2],
      0.5 * uInputPixel[3],
      destSize.width * uInputSize[2] - 0.5 * uInputPixel[2],
      destSize.height * uInputSize[3] - 0.5 * uInputPixel[3],
    ])

    // SEE: https://github.com/pixijs/pixijs/blob/c63e917/packages/core/src/filters/FilterSystem.ts#L279
    const uFilterClamp = new Float32Array([
      0.5 * uInputPixel[2],
      0.5 * uInputPixel[3],
      destSize.width * uInputSize[2] - 0.5 * uInputPixel[2],
      destSize.height * uInputSize[3] - 0.5 * uInputPixel[3],
    ])

    const filterArea = new Float32Array([destSize.width, destSize.height, 0, 0])

    return {
      inputSize: gl.uni('4fv', uInputSize),
      inputPixel: gl.uni('4fv', uInputPixel),
      inputClamp: gl.uni('4fv', uInputClamp),
      filterClamp: gl.uni('4fv', uFilterClamp),
      filterArea: gl.uni('4fv', filterArea),
    }
  }
}
