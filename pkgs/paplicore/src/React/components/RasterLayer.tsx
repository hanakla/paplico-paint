import { Document as PapDocument } from '../../DOM'

const Element = 'rasterlayer' as any

export const RasterLayer = ({
  children,
  ...props
}: PapDocument.Attributes & { children: any }) => {
  return <Element {...props} />
}
