export const ToolModes = {
  none: 'none',
  objectTool: 'objectTool',
  eraserTool: 'eraserTool',
  strokingTool: 'strokingTool',
  pointTool: 'pointTool',
  vectorPenTool: 'vectorPenTool',
  rectangleTool: 'rectangleTool',
  ellipseTool: 'ellipseTool',
  curveTool: 'curveTool',
} as const
export type ToolModes = (typeof ToolModes)[keyof typeof ToolModes]

export const EditorTypes = {
  raster: 'raster',
  vector: 'vector',
  text: 'text',
  none: 'none',
} as const
export type EditorTypes = (typeof EditorTypes)[keyof typeof EditorTypes]
