import { DBSchema, openDB } from 'idb'

interface SilkDBSchama extends DBSchema {
  projects: {
    key: string
    value: {
      uid: string
      bin: Blob
      hasSavedOnce: boolean
      updatedAt: Date
    }
    indexes?: {
      uuid: 'uid'
    }
  }
}

export const connectIdb = async () => {
  const db = await openDB<SilkDBSchama>('virse', 2, {
    upgrade(db, old, next) {
      if (old === 0) {
        db.createObjectStore('projects', {
          autoIncrement: false,
          keyPath: 'uid',
        })
      }
    },
  })

  return db
}
