type PaplicoLSSchema = {
  theme: 'light' | 'dark'
}

export class LocalStorage {
  public static set<K extends keyof PaplicoLSSchema>(
    key: K,
    value: PaplicoLSSchema[K]
  ) {
    localStorage.setItem(key, JSON.stringify(value))
  }

  public static get<K extends keyof PaplicoLSSchema>(
    key: K,
    defaultValue: PaplicoLSSchema[K]
  ): PaplicoLSSchema[K] {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : defaultValue
  }
}
