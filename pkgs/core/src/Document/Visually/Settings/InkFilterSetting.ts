export type InkSetting<T extends Record<string, any> = Record<string, any>> = {
  inkId: string
  inkVersion: string

  /** Ink specific settings */
  settings: T
}
