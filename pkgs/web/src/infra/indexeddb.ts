import { DBSchema, openDB } from 'idb'

type ProjectEntrySchema = {
  uid: string
  title: string
  bin: Blob
  hasSavedOnce: boolean
  thumbnail: Blob | null
  updatedAt: Date
}

interface PaplicoWebDBSchama extends DBSchema {
  projects: {
    key: string
    value: ProjectEntrySchema
    indexes?: {
      uuid: 'uid'
    }
  }
  autoSaveRevisions: {
    key: string
    value: ProjectEntrySchema
    indexes?: {
      uuid: 'uid'
    }
  }
}

export const connectIdb = async () => {
  const db = await openDB<PaplicoWebDBSchama>('silk', 4, {
    blocked() {
      throw new Error('Database is blocked')
    },
    upgrade(db, old, next) {
      if (old <= 1) {
        db.createObjectStore('projects', {
          autoIncrement: false,
          keyPath: 'uid',
        })
      }

      if (old <= 4) {
        if (db.objectStoreNames.contains('autoSaveRevisions')) {
          db.deleteObjectStore('autoSaveRevisions')
        }

        db.createObjectStore('autoSaveRevisions', {
          autoIncrement: true,
          keyPath: 'uid',
        })
      }
    },
  })

  return db
}
