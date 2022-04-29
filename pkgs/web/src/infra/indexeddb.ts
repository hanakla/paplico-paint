import { DBSchema, openDB } from 'idb'

interface PaplicoWebDBSchama extends DBSchema {
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
  const db = await openDB<PaplicoWebDBSchama>('silk', 2, {
    upgrade(db, old, next) {
      db.createObjectStore('projects', {
        autoIncrement: false,
        keyPath: 'uid',
      })
    },
  })

  return db
}
