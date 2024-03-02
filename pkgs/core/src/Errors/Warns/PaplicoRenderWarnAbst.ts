import { IWarn } from './IWarn'

export const RenderWarnCodes = {
  MISSING_FILTER: 'MISSING_FILTER',
}
export type RenderWarnCodes =
  (typeof RenderWarnCodes)[keyof typeof RenderWarnCodes]

export abstract class PaplicoRenderWarnAbst<T extends Record<string, any> = any>
  implements IWarn<T>
{
  public readonly name: string
  public stack?: string

  constructor(
    public message: string,
    public code: string,
    public meta: T,
  ) {
    this.name = 'PaplicoRenderWarn'
    Error.captureStackTrace(this)
  }
}
