import { Paplico, UICanvas, Document } from '@paplico/core-new'
import { useEffect, useRef } from 'react'

export function usePaplico() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const paplico = useRef<Paplico | null>(null)
  const ui = useRef<UICanvas | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    paplico.current = new Paplico(canvasRef.current!)
    ui.current = new UICanvas(canvasRef.current!)

    paplico.current.loadDocument(
      Document.createDocument({ width: 1000, height: 1000 })
    )

    console.info('Document: ', paplico.current.currentDocument)
  }, [])

  return { ref: canvasRef, paplico }
}
