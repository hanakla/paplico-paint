import mitt, {Emitter} from 'mitt'
import { Stroke } from './Stroke'

type Events = {
  stroke: Stroke
  tmpStroke: Stroke
}

export class CanvasHandler {
  protected canvas: HTMLCanvasElement
  public context: CanvasRenderingContext2D

  protected currentStroke: Stroke | null = null
  protected mitt: Emitter<Events> = mitt()

  public on: Emitter<Events>['on']
  public off: Emitter<Events>['off']

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = this.context = canvas.getContext('2d')

    this.on = this.mitt.on.bind(this.mitt)
    this.off = this.mitt.off.bind(this.mitt)

    this.canvas.addEventListener('mousedown', (e) => {
      this.currentStroke = new Stroke()
      this.currentStroke.points.push([e.offsetX, e.offsetY])
    })

    this.canvas.addEventListener('mouseup', () => {
      if (!this.currentStroke) return

      this.mitt.emit('stroke', this.currentStroke!)
      this.currentStroke = null
    })

    this.canvas.addEventListener('mousemove', (e) => {
      if (!this.currentStroke) return

      this.currentStroke.points.push([e.offsetX, e.offsetY])
      this.mitt.emit('tmpStroke', this.currentStroke)
    })
  }

}


