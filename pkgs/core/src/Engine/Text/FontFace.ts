import { FontEntry, FontStyleEntry } from '../Registry/FontRegistry'

export class FontFace {
  public async generatePath(entry: FontStyleEntry) {
    if (entry.type === 'local') {
      await entry.blob()
    }
  }
}
