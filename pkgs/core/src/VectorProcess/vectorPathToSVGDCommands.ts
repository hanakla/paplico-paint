import { VectorPath } from '@/Document'

export function vectorPathToSVGDCommands(path: VectorPath) {
  const commands = path.points.map((pt, idx) => {
    if (idx === 0) {
      return `M ${pt.x} ${pt.y}`
    }

    const prev = path.points[idx - 1] ?? pt

    // prettier-ignore
    const d =
      pt.begin && pt.end ? `C ${pt.begin.x} ${pt.begin.y} ${pt.end.x} ${pt.end.y} ${pt.x} ${pt.y}`
        : pt.begin == null && pt.end ? `C ${prev.x} ${prev.y} ${pt.end.x} ${pt.end.y} ${pt.x} ${pt.y}`
        : pt.begin && pt.end == null ? `C ${pt.begin.x} ${pt.begin.y} ${pt.x} ${pt.y} ${pt.x} ${pt.y}`
        : `L ${pt.x} ${pt.y}`

    return d
  })

  return commands.join(' ')
}
