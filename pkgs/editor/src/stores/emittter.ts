import { PplcEditorEvents } from '..'
import { useContext } from 'react'
import { StoresContext } from './context'
import { Emitter } from '@paplico/shared-lib'

export const createEmitterStore = () => {
  const emitter = new Emitter<PplcEditorEvents>()
  return emitter
}

/** Event emitter for out of editor */
export type EmitterStore = ReturnType<typeof createEmitterStore>

export const useEmitterStore = () => {
  const { emitter } = useContext(StoresContext)!
  return emitter
}
