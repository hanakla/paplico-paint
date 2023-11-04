import { createContext } from 'react'
import { StoreApi } from 'zustand'
import { EngineStore } from './engine'
import { EditorStore } from './editor'
import { EmitterStore } from './emittter'

export const StoresContext = createContext<{
  engine: StoreApi<EngineStore>
  editor: StoreApi<EditorStore>
  emitter: EmitterStore
} | null>(null)
