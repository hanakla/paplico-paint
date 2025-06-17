export interface VectorShape {
  id: string
  type: 'circle' | 'rectangle' | 'path'
  position: { x: number; y: number }
  color: { r: number; g: number; b: number; a: number }
  size: number
}

export class VectorRenderer {
  private shapes: VectorShape[] = []

  addShape(shape: VectorShape): void {
    this.shapes.push(shape)
  }

  removeShape(id: string): void {
    this.shapes = this.shapes.filter((shape) => shape.id !== id)
  }

  updateShape(id: string, updates: Partial<VectorShape>): void {
    const index = this.shapes.findIndex((shape) => shape.id === id)
    if (index !== -1) {
      this.shapes[index] = { ...this.shapes[index], ...updates }
    }
  }

  generateVertices(canvasWidth: number, canvasHeight: number): Float32Array {
    const vertices: number[] = []

    for (const shape of this.shapes) {
      if (shape.type === 'circle') {
        const circleVertices = this.generateCircleVertices(
          shape,
          canvasWidth,
          canvasHeight,
        )
        vertices.push(...circleVertices)
      } else if (shape.type === 'rectangle') {
        const rectVertices = this.generateRectangleVertices(
          shape,
          canvasWidth,
          canvasHeight,
        )
        vertices.push(...rectVertices)
      }
    }

    return new Float32Array(vertices)
  }

  private generateCircleVertices(
    shape: VectorShape,
    canvasWidth: number,
    canvasHeight: number,
  ): number[] {
    const vertices: number[] = []
    const segments = 32
    const centerX = (shape.position.x / canvasWidth) * 2 - 1
    const centerY = -((shape.position.y / canvasHeight) * 2 - 1)
    const radius = shape.size / Math.min(canvasWidth, canvasHeight)

    for (let i = 0; i < segments; i++) {
      const angle1 = (i / segments) * Math.PI * 2
      const angle2 = ((i + 1) / segments) * Math.PI * 2

      vertices.push(
        centerX,
        centerY,
        shape.color.r,
        shape.color.g,
        shape.color.b,
        shape.color.a,

        centerX + Math.cos(angle1) * radius,
        centerY + Math.sin(angle1) * radius,
        shape.color.r,
        shape.color.g,
        shape.color.b,
        shape.color.a,

        centerX + Math.cos(angle2) * radius,
        centerY + Math.sin(angle2) * radius,
        shape.color.r,
        shape.color.g,
        shape.color.b,
        shape.color.a,
      )
    }

    return vertices
  }

  private generateRectangleVertices(
    shape: VectorShape,
    canvasWidth: number,
    canvasHeight: number,
  ): number[] {
    const x1 = (shape.position.x / canvasWidth) * 2 - 1
    const y1 = -((shape.position.y / canvasHeight) * 2 - 1)
    const x2 = ((shape.position.x + shape.size) / canvasWidth) * 2 - 1
    const y2 = -(((shape.position.y + shape.size) / canvasHeight) * 2 - 1)

    return [
      x1,
      y1,
      shape.color.r,
      shape.color.g,
      shape.color.b,
      shape.color.a,
      x2,
      y1,
      shape.color.r,
      shape.color.g,
      shape.color.b,
      shape.color.a,
      x1,
      y2,
      shape.color.r,
      shape.color.g,
      shape.color.b,
      shape.color.a,

      x2,
      y1,
      shape.color.r,
      shape.color.g,
      shape.color.b,
      shape.color.a,
      x2,
      y2,
      shape.color.r,
      shape.color.g,
      shape.color.b,
      shape.color.a,
      x1,
      y2,
      shape.color.r,
      shape.color.g,
      shape.color.b,
      shape.color.a,
    ]
  }

  getShapes(): VectorShape[] {
    return [...this.shapes]
  }

  clear(): void {
    this.shapes = []
  }
}
