import { SVGDCommand } from '@/fastsvg/IndexedPointAtLength'

export function pathCommandsToString(pathCommands: SVGDCommand[]): string {
  return pathCommands
    .map(command => {
      const [cmd, ...params] = command
      return `${cmd}${params.join(',')}`
    })
    .join(' ')
}
