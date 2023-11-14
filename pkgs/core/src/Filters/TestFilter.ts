import { createFilter, PplcFilter } from '@/index'

export namespace TestFilter {
  export type Options = {
    color: string
  }
}

export const TestFilter = createFilter(
  class TestFilter implements PplcFilter.IFilter<TestFilter.Options> {
    public static metadata: PplcFilter.FilterMetadata = {
      id: '@paplico/core/filters/test',
      version: '0.0.1',
      name: 'Test Filter',
    }

    public static getInitialSetting(): TestFilter.Options {
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
      settings: state,
      setSettings: setState,
    }: PplcFilter.FilterPaneContext<TestFilter.Options>) {
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
    }: PplcFilter.FilterInitContext): Promise<void> {}

    public async applyRasterFilter(
      input: TexImageSource,
      output: CanvasRenderingContext2D,
      {
        destSize,
        pixelRatio,
        settings: filterSetting,
      }: PplcFilter.RasterFilterContext<TestFilter.Options>,
    ) {
      output.fillStyle = filterSetting.color
      output.fillRect(0, 0, destSize.width, destSize.height)
    }
  },
)
