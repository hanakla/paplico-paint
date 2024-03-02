import { PaplicoError } from './PaplicoError'

export class PPLCDisposedInstanceError extends PaplicoError {
  readonly name = 'PPLCDisposedInstanceError'

  constructor(message?: string) {
    super(message ?? 'Dispose instance used')
  }
}
