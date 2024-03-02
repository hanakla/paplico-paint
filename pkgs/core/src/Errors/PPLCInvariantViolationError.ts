import { PaplicoError } from './PaplicoError'

export class PPLCInvariantViolationError extends PaplicoError {
  readonly name = 'PPLCInvariantViolationError'
  public meta: any

  constructor(message: string, meta?: any) {
    super(
      message + ' [It cause by a bug in Paplico. Please report this issue.]',
    )
    this.meta = meta
  }
}
