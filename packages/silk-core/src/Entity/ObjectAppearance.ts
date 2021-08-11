import { assign } from '../utils'

export class ObjectAppearance {
  public static create() {
    return assign(new ObjectAppearance(), {})
  }
}
