export const ToolModes = {
  none: 'none',
  objectTool: 'objectTool',
  pointTool: 'pointTool',
  brush: 'vectorBrush',
  vectorPen: 'vectorPen',
  rectangleTool: 'rectangleTool',
  ellipseTool: 'ellipseTool',
} as const
export type ToolModes = (typeof ToolModes)[keyof typeof ToolModes]
