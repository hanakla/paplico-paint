import { PaplicoError } from './PaplicoError'

export class PPLCCanvasAllocationError extends PaplicoError {
  readonly name = 'PPLCCanvasAllocationError'

  constructor(message?: string) {
    super(message ?? 'Failed to locate canvas')
  }
}
