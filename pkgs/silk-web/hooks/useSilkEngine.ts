import { useContext } from 'react'
import { SilkEngine } from 'silk-core'
import { EngineContext } from '../lib/EngineContext'

export const useSilkEngine = (): SilkEngine | null => {
  const engine = useContext(EngineContext)

  return engine
}
