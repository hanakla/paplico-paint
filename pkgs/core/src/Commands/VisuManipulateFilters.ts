import { typedArraySafeDiff, patch, unpatch, Delta } from '@/utils/jsondiff'

import { ICommand } from '../Engine/History/ICommand'
import { DocumentContext } from '@/Engine'
import { deepClone } from '@paplico/shared-lib'
import { VisuFilter } from '@/Document'
import {
  PPLCCommandExecutionError,
  PPLCInvariantViolationError,
} from '@/Errors'

type Updater = { visuUid: string } & (
  | { add: VisuFilter.AnyFilter; insertIndex?: number }
  | { update: (filter: VisuFilter.AnyFilter) => void; filterUid: string }
  | { reorderIndex: number; filterUid: string }
  | { remove: true; filterUid: string }
)

type Updaters = Updater[]

type Patches = {
  [visuUid: string]: {
    [filterUid: string]: {
      add?: {
        filter: VisuFilter.AnyFilter
        insertIndex?: number
      }
      remove?: {
        filter: VisuFilter.AnyFilter
        index: number
      }
      reorder?: {
        filterUid: string
        fromIndex: number
        toIndex: number
      }
      update?: {
        delta: Delta
      }
    }
  }
}

/**
 * Update Visu's filters attributes batch.
 *
 * Updater details:
 * - Add new filter `{ add: AnyFilter, insertIndex?: number }`
 * - Update filter `{ update: (filter: AnyFilter) => void, filterUid: string }`
 *   - `update` function will be called with a clone of the filter.
 *     You can modify the clone and the changes will be applied to the filter.
 * - Remove filter `{ remove: true, filterUid: string }`
 * - Reorder filter `{ reorderIndex: number, filterUid: string }`
 */
export class VisuManipulateFilters implements ICommand {
  public readonly name = 'VisuManipulateFilters'

  protected updaters: Updaters

  protected effectedVisuUidSet = new Set<string>()
  protected changesPatch: Patches | null = null

  constructor(updaters: Updaters) {
    this.updaters = updaters
  }

  public async do(docx: DocumentContext): Promise<void> {
    const patches: Patches = {}

    try {
      this.updaters.forEach((task) => {
        const visuUid = task.visuUid
        const visu = docx.document.getVisuByUid(visuUid)

        if (!visu) {
          throw new PPLCCommandExecutionError(
            `Target Visu not found (uid: ${visuUid})`,
          )
        }

        const findFilterIndex = (filterUid: string) => {
          const idx = visu.filters.findIndex((f) => f.uid === filterUid)
          if (idx === -1) {
            throw new PPLCCommandExecutionError(
              `Filter (uid: ${filterUid}) not found in visu (visu uid: ${visuUid})  `,
            )
          }
          return idx
        }

        patches[visuUid] ??= {}

        this.effectedVisuUidSet.add(visuUid)

        if ('add' in task) {
          patches[visuUid][task.add.uid] = {
            add: {
              filter: task.add,
              insertIndex: task.insertIndex ?? visu.filters.length,
            },
          }
        } else if ('update' in task) {
          const filter = visu.filters[findFilterIndex(task.filterUid)]

          const next = deepClone(filter)
          task.update(next)

          patches[visuUid]![task.filterUid] = {
            update: {
              delta: typedArraySafeDiff(filter, next)!,
            },
          }
        } else if ('remove' in task) {
          const filter = visu.filters[findFilterIndex(task.filterUid)]

          patches[visuUid][task.filterUid] = {
            remove: {
              filter,
              index: visu.filters.indexOf(filter),
            },
          }
        } else if (task.reorderIndex != null) {
          const fromIndex = findFilterIndex(task.filterUid)

          patches[visuUid][task.filterUid] = {
            reorder: {
              filterUid: task.filterUid,
              fromIndex,
              toIndex: task.reorderIndex,
            },
          }
        }
      })

      this.changesPatch = patches
    } catch (e) {
      if (patches) this.revertPatches(docx, patches)
      throw e
    }

    this.changesPatch = this.changesPatch
    this.applyPatches(docx, this.changesPatch)

    docx.invalidateLayerBitmapCache([...this.effectedVisuUidSet])
  }

  public async undo(docx: DocumentContext): Promise<void> {
    this.revertPatches(docx, this.changesPatch!)
  }

  public async redo(document: DocumentContext): Promise<void> {
    this.applyPatches(document, this.changesPatch!)
  }

  protected applyPatches(docx: DocumentContext, patches: Patches) {
    for (const [visuUid, filterPatches] of Object.entries(patches)) {
      for (const [filterUid, change] of Object.entries(filterPatches)) {
        const visu = docx.resolveVisuByUid(visuUid)!

        if (change.add) {
          console.log(change.add)
          visu.filters.splice(
            change.add.insertIndex ?? visu.filters.length,
            0,
            change.add.filter,
          )
        } else if (change.remove) {
          visu.filters.splice(change.remove.index, 1)
        } else if (change.update) {
          const filter = visu.filters.find((f) => f.uid === filterUid)!
          patch(filter, change.update.delta)
        } else if (change.reorder) {
          const filter = visu.filters.find((f) => f.uid === filterUid)!
          const index = visu.filters.indexOf(filter)
          visu.filters.splice(index, 1)
          visu.filters.splice(change.reorder.toIndex, 0, filter)
        }
      }
    }
  }

  protected revertPatches(docx: DocumentContext, patches: Patches) {
    for (const [visuUid, filterPatches] of Object.entries(patches)) {
      for (const [filterUid, change] of Object.entries(filterPatches)) {
        const visu = docx.resolveVisuByUid(visuUid)!

        if (change.add) {
          const index = visu.filters.findIndex(
            (f) => f.uid === change.add!.filter.uid,
          )
          if (index === -1) {
            throw new PPLCInvariantViolationError(
              `VisuManipulateFilters.reverPatches: filter not found`,
            )
          }
          visu.filters.splice(index, 1)
        } else if (change.remove) {
          visu.filters.splice(change.remove.index, 0, change.remove.filter)
        } else if (change.update) {
          const filter = visu.filters.find((f) => f.uid === filterUid)!
          unpatch(filter, change.update.delta)
        } else if (change.reorder) {
          const filter = visu.filters.find((f) => f.uid === filterUid)!
          const index = visu.filters.indexOf(filter)
          visu.filters.splice(index, 1)
          visu.filters.splice(change.reorder.fromIndex, 0, filter)
        }
      }
    }
  }

  get effectedVisuUids() {
    return [...this.effectedVisuUidSet]
  }
}
