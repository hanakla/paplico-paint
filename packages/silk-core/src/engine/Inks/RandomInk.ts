import { IInk } from './IInk'
import { rgba } from 'polished'

const random = () => Math.round(Math.random() * 256)

export class RandomInk implements IInk {
  public color() {
    return rgba(random(), random(), random(), 1)
  }
}
