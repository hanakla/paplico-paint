import { VisuElement } from '@/Document'

export interface IFeatureHook {
  vectorObjectVisPreRender?: (
    visu: VisuElement.VectorObjectElement,
  ) => VisuElement.VectorObjectElement
  vectorPathPreRender?: (
    visu: VisuElement.VectorObjectElement,
  ) => VisuElement.VectorPath
}
