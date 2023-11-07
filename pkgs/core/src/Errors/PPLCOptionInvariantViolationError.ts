import { PaplicoError } from './PaplicoError'

/** Error for cause error by invalid user input */
export class PPLCOptionInvariantViolationError extends PaplicoError {
  name = 'PPLCOptionInvariantViolationError'
}
