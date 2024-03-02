import { Program } from './Program'
import { IMesh } from './interfaces/IMesh'

export class Scene {
  public program: Program | null = null
  public objects: IMesh[] = []

  public add(obj: IMesh) {
    this.objects.push(obj)
  }

  public remove(obj: IMesh) {
    const index = this.objects.indexOf(obj)
    if (index > -1) {
      this.objects.splice(index, 1)
    }
  }
}
