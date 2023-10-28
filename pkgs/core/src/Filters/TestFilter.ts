import { createFilter, PapFilter } from '@/index'

export namespace TestFilter {
  export type Options = {
    color: string
  }
}

export const TestFilter = createFilter(
  class TestFilter implements PapFilter.IFilter<TestFilter.Options> {
    public static metadata: PapFilter.FilterMetadata = {
      id: '@paplico/core/filters/test',
      version: '0.0.1',
      name: 'Test Filter',
    }

    public static getInitialConfig(): TestFilter.Options {
      return {
        color: '#0000FF',
      }
    }

    public static migrateSetting(
      prevVersion: string,
      config: TestFilter.Options,
    ) {
      return config
    }

    public static renderPane({
      c,
      h,
      state,
      setState,
    }: PapFilter.FilterPaneContext<TestFilter.Options>) {
      const onTextChange = (value: string) => {
        setState({ color: value })
      }

      return h(
        c.View,
        { flexFlow: 'column' },
        h(
          c.Text,
          { style: { fontSize: 16, fontWeight: 'bold' } },
          'Test Filter',
        ),
        h(c.TextInput, { value: state.color, onChange: onTextChange }),
      )
    }

    public get id() {
      return TestFilter.metadata.id
    }

    public async initialize({
      gl,
    }: PapFilter.FilterInitContext): Promise<void> {}

    public async applyRasterFilter(
      input: TexImageSource,
      output: CanvasRenderingContext2D,
      {
        destSize,
        pixelRatio,
        filterSetting,
      }: PapFilter.RasterFilterContext<TestFilter.Options>,
    ) {
      output.fillStyle = filterSetting.color
      output.fillRect(0, 0, destSize.width, destSize.height)
    }
  },
)
