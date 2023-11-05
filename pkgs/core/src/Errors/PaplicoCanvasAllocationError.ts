import { PaplicoError } from './PaplicoError'

export class PaplicoCanvasAllocationError extends PaplicoError {
  readonly name = 'PaplicoCanvasAllocationError'

  constructor(message?: string) {
    super(message ?? 'Failed to locate canvas')
  }
}
