import { IInk } from './IInk'

export class PlainInk implements IInk {
  color() {
    return '#000'
  }
}
