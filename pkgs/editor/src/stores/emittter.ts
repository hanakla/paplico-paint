import mitt from 'mitt'
import { PapEditorEvents } from '..'
import { useContext } from 'react'
import { StoresContext } from './context'

export const createEmitterStore = () => {
  const emitter = mitt<PapEditorEvents>()
  return emitter
}

export type EmitterStore = ReturnType<typeof createEmitterStore>

export const useEmitterStore = () => {
  const { emitter } = useContext(StoresContext)!
  return emitter
}