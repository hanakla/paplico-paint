export function emptyCoalease<T, U>(
  value: T | null | undefined,
  defaultValue: U,
): T | U {
  return (Array.isArray(value) && value.length === 0) || value == '' || !value
    ? defaultValue
    : value
}
