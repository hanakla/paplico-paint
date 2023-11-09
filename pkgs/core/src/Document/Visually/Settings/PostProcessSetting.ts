export type PostProcessSetting<
  T extends Record<string, any> = Record<string, any>,
> = {
  filterId: string
  filterVersion: string

  enabled: boolean

  /** 0..1 */
  opacity: number
  settings: T
}
