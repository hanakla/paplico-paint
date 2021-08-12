export const log = (...args: any[]) => {
  console.log(
    `%csilk%c`,
    'padding:2px 4px;background:linear-gradient(40deg, #47a7f2, #45d098);color:#fff;border-radius:4px;',
    '',
    ...args
  )
}
