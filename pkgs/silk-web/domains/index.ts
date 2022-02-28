import Fleur from '@fleur/fleur'
import { AppStore } from './App'
import { EditorStore } from './EditorStable'

const app = new Fleur({
  stores: [AppStore, EditorStore],
})

export const createContext = () => app.createContext()
