import { PaplicoIgnoreableError } from './PaplicoIgnoreableError'

export class PaplicoAbortError extends PaplicoIgnoreableError {
  constructor(
    message: string = 'Aborted by controled',
    options?: ErrorOptions
  ) {
    super(message, options)
  }
}
