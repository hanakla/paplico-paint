import { assign } from '../utils'
import { ISilkDOMElement } from './ISilkDOMElement'

export class ObjectAppearance implements ISilkDOMElement {
  public static create() {
    return assign(new ObjectAppearance(), {})
  }

  public serialize() {
    return {}
  }
}
