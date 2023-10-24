import { Paplico } from '@/Paplico'
import { RuntimeDocument } from '../RuntimeDocument'

export namespace IExporter {
  export type Context = {
    paplico: Paplico
    runtimeDocument: RuntimeDocument
  }

  export type Options<T = {}> = T & {
    targetNodePath?: string[]
    // /** 0 to 100 */
    // quality?: number

    /**
     * The pixelRatio that should be applied to the size of the Canvas element.
     *  this value is set to take dpi into account.
     */
    pixelRatio: number

    /**
     * defaults to 96
     * SEE: https://html.spec.whatwg.org/multipage/canvas.html#serialising-bitmaps-to-a-file
     */
    dpi: number
  }

  export type OptionsToRequest<T extends Options> = Omit<
    T,
    'pixelRatio' | 'dpi'
  > & {
    dpi?: number
  }
}

export interface IExporter {
  export(ctx: IExporter.Context, options: IExporter.Options): Promise<Blob>
}
