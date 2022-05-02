export const log = (...args: any[]) => {
  console.log(
    `%cpaplico%c`,
    'padding:2px 4px;background:linear-gradient(40deg, #47a7f2, #45d098);color:#fff;border-radius:4px;',
    '',
    ...args
  )
}

export const warn = (...args: any) => {
  console.warn(
    '%cpaplico%c',
    'padding:2px 4px;background:linear-gradient(40deg, #e8a949, #ee6b45);color:#fff;border-radius:4px;',
    '',
    ...args
  )
}

export const trace = (...args: any[]) => {
  console.groupCollapsed(
    `%cpaplico(trace)%c %s`,
    'padding:2px 4px;background:linear-gradient(40deg, #9047f2, #4552d0);color:#fff;border-radius:4px;',
    '',
    ...args
  )
  console.trace('Callstack')
  console.groupEnd()
}
