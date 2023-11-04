export const RasterToolModes = {
  cursor: 'cursor',
  stroking: 'stroking',
  erasing: 'erasing',
} as const
export type RasterToolModes =
  (typeof RasterToolModes)[keyof typeof RasterToolModes]

export const VectorToolModes = {
  none: 'none',
  stroking: 'stroking',
  objectTool: 'objectTool',
  pointTool: 'pointTool',
  vectorPen: 'vectorPen',
  rectangleTool: 'rectangleTool',
  ellipseTool: 'ellipseTool',
} as const
export type VectorToolModes =
  (typeof VectorToolModes)[keyof typeof VectorToolModes]

export const EditorTypes = {
  raster: 'raster',
  vector: 'vector',
  text: 'text',
  none: 'none',
} as const
export type EditorTypes = (typeof EditorTypes)[keyof typeof EditorTypes]
