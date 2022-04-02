import { useContext } from 'react'
import { Silk } from 'silk-core'
import { EngineContext } from '../lib/EngineContext'

export const useSilkEngine = (): Silk | null => {
  const engine = useContext(EngineContext)

  return engine
}
