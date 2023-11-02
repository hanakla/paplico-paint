import { PaplicoRenderWarn, RenderWarnCodes } from '../PaplicoRenderWarn'

export class MissingFilterWarn extends PaplicoRenderWarn<{
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
