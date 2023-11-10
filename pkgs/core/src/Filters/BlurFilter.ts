import { createFilter, PplcFilter } from '@/index'

export namespace BlurFilter {
  export type Options = {
    size: number
  }
}

export const BlurFilter = createFilter(
  class BlurFilter implements PplcFilter.IFilter<BlurFilter.Options> {
    public static metadata: PplcFilter.FilterMetadata = {
      id: '@paplico/core/filters/Blur',
      version: '0.0.1',
      name: 'Blur Filter',
    }

    public static getInitialSetting(): BlurFilter.Options {
      return {
        size: 5,
      }
    }

    public static migrateSetting(
      prevVersion: string,
      config: BlurFilter.Options,
    ) {
      return config
    }

    public static renderPane({
      c,
      h,
      settings: state,
      setSettings: setState,
    }: PplcFilter.FilterPaneContext<BlurFilter.Options>) {
      const onValueChange = (value: number) => {
        setState({ size: value })
      }

      return h(
        c.View,
        { flexFlow: 'column' },
        h(c.FieldSet, {
          title: 'Blur size',
          inputs: h(c.Slider, { value: state.size, onChange: onValueChange }),
          displayValue: state.size.toString(),
        }),
      )
    }

    public get id() {
      return BlurFilter.metadata.id
    }

    public async initialize({
      gl,
    }: PplcFilter.FilterInitContext): Promise<void> {}

    public async applyRasterFilter(
      input: PplcFilter.FilterInputSource,
      output: CanvasRenderingContext2D,
      {
        destSize,
        pixelRatio,
        filterSetting,
      }: PplcFilter.RasterFilterContext<BlurFilter.Options>,
    ) {
      output.filter = `blur(${filterSetting.size * pixelRatio}px)`
      output.drawImage(
        input,
        0,
        0,
        destSize.width * pixelRatio,
        destSize.height * pixelRatio,
      )
    }
  },
)
