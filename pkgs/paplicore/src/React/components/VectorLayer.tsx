import { VectorLayer as PapVectorLayer } from '../../DOM'

const Element = 'vectorlayer' as any

export const VectorLayer = ({
  children,
  ...props
}: PapVectorLayer.Attributes & { children: any }) => {
  return <Element {...props} />
}
