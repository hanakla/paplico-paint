export interface ISilkDOMElement {
  update(proc: (entity: this) => void): void
  serialize(): object
}
