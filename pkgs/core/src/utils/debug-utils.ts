export function formatStack(e: Error, indent = 0) {
  return e.stack
    ?.replace(/^.+\n/g, '')
    .replace(/^\s*/gm, '')
    .replace(/^/gm, ' '.repeat(indent))
}
