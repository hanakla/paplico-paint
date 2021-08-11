export const log = (msg: string, ...args: any[]) => {
  console.log(
    `%csilk%c ${msg}`,
    'padding:2px 4px;background:linear-gradient(40deg, #47a7f2, #45d098);color:#fff;border-radius:4px;',
    ...args
  )
}
