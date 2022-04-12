type SilkLSSchema = {
  theme: 'light' | 'dark'
}

export class LocalStorage {
  public static set<K extends keyof SilkLSSchema>(
    key: K,
    value: SilkLSSchema[K]
  ) {
    localStorage.setItem(key, JSON.stringify(value))
  }

  public static get<K extends keyof SilkLSSchema>(
    key: K,
    defaultValue: SilkLSSchema[K]
  ): SilkLSSchema[K] {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : defaultValue
  }
}
