export type LayerFilter = {
  uid: string
  filterId: string
  filterVersion: string

  enabled: boolean

  /** 0..1 */
  opacity: number
  settings: Record<string, any>
}
