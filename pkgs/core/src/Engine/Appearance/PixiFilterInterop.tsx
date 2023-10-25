import { FilterContext, FilterInitContext, IFilter } from '../Filter'

export abstract class AbstractPixiFilterInterop implements IFilter {
  abstract get id(): string
  abstract get initialConfig(): any
  abstract initialize({ gl }: FilterInitContext): Promise<void>
  abstract render(ctx: FilterContext<Record<string, any>>): Promise<void>
  protected getPixiUniforms({
    gl,
    size,
  }: FilterContext<Record<string, any>>): any {
    const reso = 1

    // SEE: https://github.com/pixijs/pixijs/blob/c63e917/packages/core/src/filters/FilterSystem.ts#L274
    const uInputSize = new Float32Array([
      size.width,
      size.height,
      1.0 / size.width,
      1.0 / size.height,
    ])

    // SEE: https://github.com/pixijs/pixijs/blob/c63e917/packages/core/src/filters/FilterSystem.ts#L274
    const uInputPixel = new Float32Array([
      Math.round(size.width * reso),
      Math.round(size.height * reso),
      1 / Math.round(size.width * reso),
      1 / Math.round(size.height * reso),
    ])

    // SEE: https://github.com/pixijs/pixijs/blob/c63e917/packages/core/src/filters/FilterSystem.ts#L279
    const uInputClamp = new Float32Array([
      0.5 * uInputPixel[2],
      0.5 * uInputPixel[3],
      size.width * uInputSize[2] - 0.5 * uInputPixel[2],
      size.height * uInputSize[3] - 0.5 * uInputPixel[3],
    ])

    // SEE: https://github.com/pixijs/pixijs/blob/c63e917/packages/core/src/filters/FilterSystem.ts#L279
    const uFilterClamp = new Float32Array([
      0.5 * uInputPixel[2],
      0.5 * uInputPixel[3],
      size.width * uInputSize[2] - 0.5 * uInputPixel[2],
      size.height * uInputSize[3] - 0.5 * uInputPixel[3],
    ])

    const filterArea = new Float32Array([size.width, size.height, 0, 0])

    return {
      inputSize: gl.uni4fv(uInputSize),
      inputPixel: gl.uni4fv(uInputPixel),
      inputClamp: gl.uni4fv(uInputClamp),
      filterClamp: gl.uni4fv(uFilterClamp),
      filterArea: gl.uni4fv(filterArea),
    }
  }
}
