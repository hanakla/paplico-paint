import Pipe from '../pipe'
import { Config, FilterContext } from '../types'

export default class Context<T = any> {
  public exiting?: boolean
  public options: Config = {}

  public root?: Context
  public nested: boolean | undefined
  public parent?: Context
  public childName?: string | number
  public children?: Context[]

  public left: any
  public right: any
  public pipe?: string | Pipe

  public objectHash?: (obj: any, index?: number) => string
  public matchByPosition?: boolean

  public next?: Context | null
  public nextAfterChildren?: Context | null
  public nextPipe?: string | Pipe

  public hasResult?: boolean

  public leftType?: string
  public leftIsArray?: boolean
  public result?: T

  public hashCache1?: string[]
  public hashCache2?: string[]

  setResult(result: T) {
    this.result = result
    this.hasResult = true
    return this
  }

  exit() {
    this.exiting = true
    return this
  }

  public switchTo(next: Pipe): this
  public switchTo(next: string, pipe: Pipe): this
  public switchTo(next: string | Pipe, pipe?: Pipe) {
    if (typeof next === 'string' || next instanceof Pipe) {
      this.nextPipe = next
    } else {
      this.next = next
      if (pipe) {
        this.nextPipe = pipe
      }
    }

    return this
  }

  push(child: Context, name: string | number) {
    child.parent = this
    if (typeof name !== 'undefined') {
      child.childName = name
    }
    child.root = this.root || this
    child.options = child.options || this.options
    if (!this.children) {
      this.children = [child]
      this.nextAfterChildren = this.next || undefined
      this.next = child
    } else {
      this.children[this.children.length - 1].next = child
      this.children.push(child)
    }
    child.next = this
    return this
  }
}
