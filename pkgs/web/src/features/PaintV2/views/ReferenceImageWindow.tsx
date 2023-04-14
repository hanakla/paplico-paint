import { loadImageFromBlob, useFunk } from '@hanakla/arma'
import { memo, useState } from 'react'
import { useToggle } from 'react-use'
import { Dropzone } from '🙌/components/Dropzone'
import { FloatingWindow } from '🙌/components/FloatingWindow'

export const ReferenceImageWindow = memo(function ReferenceImageWindow() {
  const [opened, toggleOpened] = useToggle(false)
  const [referenceImage, setReferenceImage] = useState<string | null>(null)
  const [referencePosition, setReferencePosition] = useState({ x: 200, y: 0 })

  const handleDropReference = useFunk(async (files: File[]) => {
    if (referenceImage != null) URL.revokeObjectURL(referenceImage)

    const { image, url } = await loadImageFromBlob(files[0])
    setReferenceImage(url)
  })

  return (
    <FloatingWindow title="Reference">
      {referenceImage ? (
        <img
          css={`
            max-width: 100%;
            user-select: none;
            pointer-events: none;
          `}
          src={referenceImage}
        />
      ) : (
        <Dropzone
          css={`
            padding: 16px 0;
            text-align: center;
          `}
          onFilesDrop={handleDropReference}
        >
          リファレンス画像を選ぶ
        </Dropzone>
      )}
    </FloatingWindow>
  )
})
