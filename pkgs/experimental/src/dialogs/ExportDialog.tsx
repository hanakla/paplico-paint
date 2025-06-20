'use client'

import { useState, useCallback } from 'react'
import { useEventCallback } from '@paplico/shared-lib/react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, FileImage, Eye } from 'lucide-react'
import { Artboard } from '@/engine/document/artboard'
import {
  PngAllArtboardExporter,
  PngExportOptions,
} from '@/engine/exporters/PngAllArtboardExporter'
import { DocumentContext } from '@/engine/document-manager'
import { WebGPUEngine } from '@/engine/webgpu/core-engine'

interface ExportDialogProps {
  artboards: Artboard[]
  documentContext: DocumentContext
  webgpuEngine: WebGPUEngine
  children?: React.ReactNode
}

interface ExportPreview {
  artboardId: string
  previewUrl: string | null
  isGenerating: boolean
}

export const ExportDialog = ({
  artboards,
  documentContext,
  webgpuEngine,
  children,
}: ExportDialogProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedArtboards, setSelectedArtboards] = useState<Set<string>>(
    new Set(),
  )
  const [isExporting, setIsExporting] = useState(false)
  const [previews, setPreviews] = useState<Map<string, ExportPreview>>(
    new Map(),
  )

  const handleArtboardToggle = useEventCallback(
    (artboardId: string, checked: boolean) => {
      const newSelection = new Set(selectedArtboards)
      if (checked) {
        newSelection.add(artboardId)
      } else {
        newSelection.delete(artboardId)
      }
      setSelectedArtboards(newSelection)
    },
  )

  const handleSelectAll = useEventCallback(() => {
    const visibleArtboards = artboards.filter((ab) => ab.visible)
    setSelectedArtboards(new Set(visibleArtboards.map((ab) => ab.id)))
  })

  const handleSelectNone = useEventCallback(() => {
    setSelectedArtboards(new Set())
  })

  const generatePreview = useEventCallback(async (artboardId: string) => {
    const artboard = artboards.find((ab) => ab.id === artboardId)
    if (!artboard) return

    setPreviews(
      (prev) =>
        new Map(
          prev.set(artboardId, {
            artboardId,
            previewUrl: null,
            isGenerating: true,
          }),
        ),
    )

    try {
      // 小さなプレビュー用のエクスポーター作成（特定のアートボードのみ）
      const exporter = new PngAllArtboardExporter({
        selectedArtboardIds: [artboardId],
      })
      const files = await exporter.export(documentContext, webgpuEngine)

      if (files.length > 0) {
        const previewUrl = URL.createObjectURL(files[0])
        setPreviews(
          (prev) =>
            new Map(
              prev.set(artboardId, {
                artboardId,
                previewUrl,
                isGenerating: false,
              }),
            ),
        )
      }
    } catch (error) {
      console.error('Preview generation failed:', error)
      setPreviews(
        (prev) =>
          new Map(
            prev.set(artboardId, {
              artboardId,
              previewUrl: null,
              isGenerating: false,
            }),
          ),
      )
    }
  })

  const handleExport = useEventCallback(async () => {
    if (selectedArtboards.size === 0) return

    setIsExporting(true)
    try {
      const exporter = new PngAllArtboardExporter({
        selectedArtboardIds: Array.from(selectedArtboards),
      })
      const files = await exporter.export(documentContext, webgpuEngine)

      // ファイルをダウンロード
      for (const file of files) {
        const url = URL.createObjectURL(file)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }

      setIsOpen(false)
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsExporting(false)
    }
  })

  const visibleArtboards = artboards.filter((ab) => ab.visible)
  const allSelected =
    visibleArtboards.length > 0 &&
    visibleArtboards.every((ab) => selectedArtboards.has(ab.id))

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            エクスポート
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileImage className="w-5 h-5" />
            PNG エクスポート
          </DialogTitle>
          <DialogDescription>
            書き出すアートボードを選択してください
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 選択コントロール */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              disabled={allSelected}
            >
              すべて選択
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectNone}
              disabled={selectedArtboards.size === 0}
            >
              選択解除
            </Button>
            <Badge variant="secondary">
              {selectedArtboards.size} / {visibleArtboards.length} 選択中
            </Badge>
          </div>

          {/* アートボード一覧 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleArtboards.map((artboard) => {
              const isSelected = selectedArtboards.has(artboard.id)
              const preview = previews.get(artboard.id)

              return (
                <div key={artboard.id} className="space-y-2">
                  {/* サムネイルカード */}
                  <Card
                    className={`cursor-pointer transition-all ${
                      isSelected
                        ? 'ring-2 ring-blue-500'
                        : 'hover:ring-1 hover:ring-gray-300'
                    }`}
                    onClick={() =>
                      handleArtboardToggle(artboard.id, !isSelected)
                    }
                  >
                    <div className="w-full aspect-square bg-gray-100 rounded flex items-center justify-center relative overflow-hidden">
                      {preview?.previewUrl ? (
                        <img
                          src={preview.previewUrl}
                          alt={`${artboard.name} プレビュー`}
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : preview?.isGenerating ? (
                        <div className="text-xs text-gray-500">生成中...</div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            generatePreview(artboard.id)
                          }}
                          className="text-xs h-6"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          プレビュー
                        </Button>
                      )}
                    </div>
                  </Card>

                  {/* チェックボックスとアートボード名（カード外） */}
                  <div className="flex items-start gap-2 px-1">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) =>
                        handleArtboardToggle(artboard.id, !!checked)
                      }
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{artboard.name}</div>
                      <div className="text-xs text-gray-500">
                        {Math.round(artboard.bounds.width)} ×{' '}
                        {Math.round(artboard.bounds.height)} px
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {visibleArtboards.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              表示可能なアートボードがありません
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            キャンセル
          </Button>
          <Button
            onClick={handleExport}
            disabled={selectedArtboards.size === 0 || isExporting}
          >
            {isExporting
              ? '書き出し中...'
              : `${selectedArtboards.size}個のアートボードを書き出し`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
