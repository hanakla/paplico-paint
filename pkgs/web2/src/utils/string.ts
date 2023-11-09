export function getLine(str: string, startLine: number, lines: number) {
  return str.split('\n').slice(startLine, lines).join('\n')
}
