export const roundString = (num: number, digits: number = 0) => {
  if (digits === 0) return Math.round(num).toString()
  return (Math.round(num * 10 ** digits) / 10 ** digits).toFixed(digits)
}
