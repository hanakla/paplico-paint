import { selectFile, useFunk } from '@hanakla/arma'
import { CSSProperties, ReactNode } from 'react'
import { useDropArea } from 'react-use'

type Props = {
  className?: string
  children: ReactNode
  style?: CSSProperties
  onFilesDrop: (files: File[]) => void
}

export const Dropzone = ({
  className,
  children,
  onFilesDrop,
  style,
}: Props) => {
  const [bindDrop] = useDropArea({
    onFiles: onFilesDrop,
  })

  const handleClick = useFunk(async () => {
    const files = await selectFile({ directory: false })
    onFilesDrop(files)
  })

  return (
    <div
      className={className}
      style={style}
      onClick={handleClick}
      {...bindDrop}
    >
      {children}
    </div>
  )
}
