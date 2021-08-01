import { useContext } from "react"
import { SilkEngine } from "../../silk-core/src/engine/Engine"
import { EngineContext } from "../lib/EngineContext"

export const useSilkEngine = (): SilkEngine | null => {
  const engine = useContext(EngineContext)

  return engine
}
