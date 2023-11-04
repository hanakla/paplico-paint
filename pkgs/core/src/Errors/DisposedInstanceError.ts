import { PaplicoError } from './PaplicoError'

export class DisposedInstanceError extends PaplicoError {
  readonly name = 'DisposedInstanceError'

  constructor(message?: string) {
    super(message ?? 'Dispose instance used')
  }
}
