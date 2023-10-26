export type LayerFilter<T extends Record<string, any> = Record<string, any>> = {
  uid: string
  filterId: string
  filterVersion: string

  enabled: boolean

  /** 0..1 */
  opacity: number
  settings: T
}
