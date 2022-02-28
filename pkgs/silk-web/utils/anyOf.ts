type A<T> = B<T>['_hack']
type B<T> = { _hack: T }

export const any = <T>(value: T) => ({
  of: (...values: A<T>[]): boolean => values.includes(value),
})