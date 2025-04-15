import { PPLCIgnoreableError } from './PPLCIgnoreableError'

export class PPLCAbortError extends PPLCIgnoreableError {
  constructor(message = 'Aborted by controled', options?: ErrorOptions) {
    super(message, options)
  }
}
