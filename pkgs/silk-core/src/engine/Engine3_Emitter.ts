import mitt, { EventType } from 'mitt'

export class Emitter<Events extends Record<EventType, unknown>> {
  protected mitt = mitt<Events>()
  public on = this.mitt.on.bind(this.mitt)
  public off = this.mitt.off.bind(this.mitt)
  protected emit = this.mitt.emit.bind(this.mitt)
}
