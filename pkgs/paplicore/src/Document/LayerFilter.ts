export type LayerFilter = {
  filterId: string
  filterVersion: string

  enabled: boolean

  /** 0..1 */
  opacity: number
  settings: Record<string, any>
}
