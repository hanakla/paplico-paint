export type InkSetting<T extends Record<string, any> | null = {}> = {
  inkId: string
  inkVersion: string

  /** Ink specific settings */
  specific: T
}
