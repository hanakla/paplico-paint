import { useContext } from 'react'
import { Silk3 } from 'silk-core'
import { EngineContext } from '../lib/EngineContext'

export const useSilkEngine = (): Silk3 | null => {
  const engine = useContext(EngineContext)

  return engine
}
