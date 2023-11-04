export interface Shortcuts {
  global: {
    save: string[] | null
    undo: string[] | null
    redo: string[] | null
    copy: string[] | null
    paste: string[] | null
    cut: string[] | null
    delete: string[] | null
    selectAll: string[] | null
    unselectAll: string[] | null

    brushTool: string[] | null

    // vector
    vectorShapeRectTool: string[] | null
    vectorEllipseTool: string[] | null
    vectorObjectTool: string[] | null
    vectorPointTool: string[] | null
  }
}

export type PartialShortcuts = {
  [K in keyof Shortcuts]?: Partial<Shortcuts[K]>
}

export const DEFAULT_SHORTCUTS: Shortcuts = {
  global: {
    save: ['command+s', 'ctrl+s'],
    undo: ['command+z', 'ctrl+z'],
    redo: ['command+shift+z', 'ctrl+shift+z', 'ctrl+y'],
    copy: ['command+c', 'ctrl+c'],
    paste: ['command+v', 'ctrl+v'],
    cut: ['command+x', 'ctrl+x'],
    delete: ['backspace', 'delete'],
    selectAll: ['command+a', 'ctrl+a'],
    unselectAll: ['command+shift+a', 'ctrl+shift+a'],

    brushTool: ['b'],

    // vector
    vectorShapeRectTool: ['m'],
    vectorEllipseTool: ['l'],
    vectorObjectTool: ['v'],
    vectorPointTool: ['a'],
  } satisfies Shortcuts['global'],
}

export const mergeShortcuts = (a: Partial<Shortcuts>): Required<Shortcuts> => {
  return {
    global: {
      ...DEFAULT_SHORTCUTS.global,
      ...a.global,
    },
  }
}
