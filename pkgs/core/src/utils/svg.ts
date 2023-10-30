import { VectorPath } from '@/Document'
import { pointsToSVGCommandArray } from '@/stroking-utils'

export function getOrCreateSVGElement(id: string) {
  const svg =
    document.getElementById(id) ??
    document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.id = id
  svg.setAttribute('width', '1000')
  svg.setAttribute('height', '1000')
  return svg as SVGSVGElement
}

export function createSVGPathByVectorPath(input: VectorPath) {
  const commands = pointsToSVGCommandArray(input.points)

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', commands.map((f) => f.join(' ')).join(' '))
  path.setAttribute('stroke', 'red')
  path.setAttribute('fill', 'none')

  // const svg: SVGSVGElement =
  //   document.getElementById('svg') ??
  //   document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  // svg.id = 'svg'
  // svg.setAttribute('width', '1000')
  // svg.setAttribute('height', '1000')
  // svg.appendChild(path)

  return path
}
