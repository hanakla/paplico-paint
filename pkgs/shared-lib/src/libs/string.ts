export function roundString(num: number, digits: number = 0) {
  if (digits === 0) return Math.round(num).toString()
  return (Math.round(num * 10 ** digits) / 10 ** digits).toFixed(digits)
}

export function humanizedBytes(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024))
  const unitValue = bytes / Math.pow(1024, unitIndex)
  return `${roundString(unitValue, 2)} ${units[unitIndex]}`
}
