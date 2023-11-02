import { createContext } from 'react'
import { StoreApi } from 'zustand'
import { EngineStore } from './engine'
import { EditorStore } from './editor'

export const StoresContext = createContext<{
  engine: StoreApi<EngineStore>
  editor: StoreApi<EditorStore>
} | null>(null)
