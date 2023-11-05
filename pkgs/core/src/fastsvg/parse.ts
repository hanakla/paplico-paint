/*!
  Copyright (c) 2013 Jake Rosoman <jkroso@gmail.com>
  Licensed under the MIT License (MIT), see  https://github.com/jkroso/parse-svg-path/blob/master/License

  Original from https://github.com/jkroso/parse-svg-path/blob/master/index.js
  Fork for fast parsing
*/

/** expected argument lengths */
const argLength = {
  a: 7,
  c: 6,
  h: 1,
  l: 2,
  m: 2,
  q: 4,
  s: 4,
  t: 2,
  v: 1,
  z: 0,
}

/** segment pattern */
const SEGMENT_PATTERN: RegExp = /([astvzqmhlc])([^astvzqmhlc]*)/gi

const NUMBER_PATTERN = /-?[0-9]*\.?[0-9]+(?:e[-+]?\d+)?/gi

function parseValues(args: string) {
  var numbers = args.match(NUMBER_PATTERN)
  return numbers ? numbers.map(parseFloat) : []
}

/**
 * parse an svg path data string. Generates an Array
 * of commands where each command is an Array of the
 * form `[command, arg1, arg2, ...]`
 *
 * @param {String} path
 * @return {Array}
 */
export const parseSVGPath = function parseSVGPath(path: string) {
  const data: [command: string, ...args: number[]][] = []
  const matches = Array.from(path.matchAll(SEGMENT_PATTERN))

  for (let [, command, args] of matches) {
    let type = command.toLowerCase() as keyof typeof argLength
    let parsedArgs: number[] = parseValues(args)

    // overloaded moveTo
    if (type == 'm' && parsedArgs.length > 2) {
      data.push([command, ...parsedArgs.splice(0, 2)])
      type = 'l'
      command = command == 'm' ? 'l' : 'L'
    }

    if (parsedArgs.length == argLength[type]) {
      data.push([command, ...parsedArgs])
      continue
    }

    if (parsedArgs.length < argLength[type]) {
      console.warn(command, args, matches)
      debugger
      throw new Error('malformed path data')
    }

    data.push([command, ...parsedArgs.splice(0, argLength[type])])
  }

  return data
}
