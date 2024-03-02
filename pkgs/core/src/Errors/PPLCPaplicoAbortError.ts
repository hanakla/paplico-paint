import { PPLCIgnoreableError } from './PPLCIgnoreableError'

export class PPLCAbortError extends PPLCIgnoreableError {
  constructor(
    message: string = 'Aborted by controled',
    options?: ErrorOptions,
  ) {
    super(message, options)
  }
}
