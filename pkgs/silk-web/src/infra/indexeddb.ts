import { DBSchema, openDB } from 'idb'

interface SilkDBSchama extends DBSchema {
  projects: {
    key: string
    value: {
      uid: string
      title: string
      bin: Blob
      hasSavedOnce: boolean
      thumbnail: Blob
      updatedAt: Date
    }
    indexes?: {
      uuid: 'uid'
    }
  }
}

export const connectIdb = async () => {
  const db = await openDB<SilkDBSchama>('silk', 2, {
    upgrade(db, old, next) {
      db.createObjectStore('projects', {
        autoIncrement: false,
        keyPath: 'uid',
      })
    },
  })

  return db
}
