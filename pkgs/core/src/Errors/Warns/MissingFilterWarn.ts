import { PaplicoRenderWarnAbst, RenderWarnCodes } from './PaplicoRenderWarnAbst'

export class MissingFilterWarn extends PaplicoRenderWarnAbst<{
  filterId: string
  at: string
}> {
  constructor(filterId: string, at: string) {
    super(`Missing filter: ${filterId}`, RenderWarnCodes.MISSING_FILTER, {
      filterId,
      at,
    })
  }
}
