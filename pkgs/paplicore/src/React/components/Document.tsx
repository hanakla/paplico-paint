import { Document as PapDocument } from '../../DOM'

const Element = 'document' as any

export const Document = ({
  children,
  ...props
}: PapDocument.Attributes & { children: any }) => {
  return <Element {...props}>{children}</Element>
}
