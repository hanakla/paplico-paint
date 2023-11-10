import { Delta, diff, patch, unpatch } from 'jsondiffpatch'
import { ICommand } from '../Engine/History/ICommand'
import { DocumentContext } from '@/Engine'
import { deepClone } from '@paplico/shared-lib'
import { VisuElement } from '@/Document'
import { createCanvasVisually } from '@/Document/Visually/factory'
import { imageBitmapToImageData } from '@/utils/imageObject'
import { PPLCOptionInvariantViolationError } from '@/Errors'

type CreateParams = Omit<
  Parameters<typeof createCanvasVisually>[0],
  'width' | 'height' | 'bitmap'
> & {
  /** Pass to createImageBitmap() internally */
  colorSpaceConversion?: ImageBitmapOptions['colorSpaceConversion']
  /** Pass to createImageBitmap() internally */
  imageOrientation?: ImageBitmapOptions['imageOrientation']
  /** Pass to createCanvas and canvas.getImageData internally */
  colorSpace?: PredefinedColorSpace
}

/** @deprecated */
export class DocumentAddCanvasVisuFromImage implements ICommand {
  public readonly name = 'DocumentAddCanvasVisuFromImage'

  protected image: ImageBitmapSource
  protected params: CreateParams
  protected visu: VisuElement.AnyElement | null = null

  protected targetNodePath: string[] = []
  protected changesPatch: Delta | null = null

  constructor(
    image: ImageBitmapSource,
    params: CreateParams,
    pathToParent: string[] = [],
  ) {
    this.image = image
    this.params = params
    this.targetNodePath = pathToParent
  }

  dispose(): void {
    this.image = null!
    this.visu = null!
  }

  public async do(docx: DocumentContext): Promise<void> {
    if (!docx.document.layerNodes.isChildContainableNode(this.targetNodePath)) {
      throw new PPLCOptionInvariantViolationError(
        `CanvasVisuUpdateBitmap.do: Target node is not contaienr node: /${this.targetNodePath.join(
          '/',
        )}`,
      )
    }

    const {
      colorSpaceConversion,
      imageOrientation,
      colorSpace,
      ...visuParams
    } = this.params

    const bitmap = await createImageBitmap(this.image, { colorSpaceConversion })
    const imageData = imageBitmapToImageData(bitmap, { colorSpace })

    this.visu = createCanvasVisually({
      width: imageData.width,
      height: imageData.height,
      bitmap: imageData.data,
      ...visuParams,
    })

    const original = deepClone(docx.layerTreeRoot)
    docx.document.__internal_AddLayerNode(this.visu, this.targetNodePath, -1)
    this.changesPatch = diff(original, docx.layerTreeRoot)!

    setTimeout(() => bitmap.close())
  }

  public async undo(document: DocumentContext): Promise<void> {
    if (!this.changesPatch) return

    unpatch(document.layerTreeRoot, this.changesPatch)
  }

  public async redo(document: DocumentContext): Promise<void> {
    if (!this.changesPatch) return

    patch(document.layerTreeRoot, this.changesPatch)
  }

  get effectedVisuUids() {
    return [this.visu!.uid]
  }
}
