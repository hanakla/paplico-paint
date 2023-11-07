export type InkSetting<T extends Record<string, any> = {}> = {
  inkId: string
  inkVersion: string

  /** Ink specific settings */
  settings: T
}
