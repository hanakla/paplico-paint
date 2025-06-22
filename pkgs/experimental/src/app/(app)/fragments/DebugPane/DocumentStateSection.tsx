'use client'

import { memo } from 'react'
import { snapshot, useSnapshot } from 'valtio'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PaplicoEngine } from '@/engine/paplico'

interface DocumentStateSectionProps {
  paplico: PaplicoEngine | null
}

export const DocumentStateSection = memo(
  ({ paplico }: DocumentStateSectionProps) => {
    const document = paplico?.getActiveDocument()

    if (!document) {
      return (
        <Card className="p-0.5">
          <CardHeader className="p-0 m-0">
            <CardTitle className="text-xs font-medium p-1 m-0 leading-none">
              ドキュメント状態
            </CardTitle>
          </CardHeader>
          <CardContent className="p-1 pt-0">
            <div className="text-xs text-muted-foreground">
              ドキュメントが利用できません
            </div>
          </CardContent>
        </Card>
      )
    }

    const layers = Object.values(document.layers || {})
    const artObjects = Object.values(document.artObjects || {})
    const artboards = Object.values(document.artboards || {})

    // レイヤー統計
    const visibleLayerCount = layers.filter((layer) => layer.visible).length
    const vectorLayerCount = layers.filter(
      (layer) => layer.type === 'vector',
    ).length
    const groupLayerCount = layers.filter(
      (layer) => layer.type === 'group',
    ).length

    // アートオブジェクト統計
    const pathObjectCount = artObjects.filter(
      (obj) => obj.type === 'path',
    ).length
    const visibleObjectCount = artObjects.filter((obj) => obj.visible).length

    return (
      <div className="space-y-0.5 text-xs">
        <Card className="p-0.5">
          <CardHeader className="p-0 m-0">
            <CardTitle className="text-xs font-medium p-1 pb-0.5 m-0 leading-none">
              基本情報
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0.5 p-1 pt-0">
            <div className="flex justify-between text-xs">
              <span>ID:</span>
              <code className="text-xs bg-muted px-0.5 rounded">
                {document.id?.slice(0, 6)}...
              </code>
            </div>
            <div className="flex justify-between text-xs">
              <span>アクティブ:</span>
              <code className="text-xs bg-muted px-0.5 rounded">
                {document.activeLayerId?.slice(0, 6)}...
              </code>
            </div>
          </CardContent>
        </Card>

        <Card className="p-0.5">
          <CardHeader className="p-0 m-0">
            <CardTitle className="text-xs font-medium p-1 pb-0.5 m-0 leading-none">
              統計
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0.5 p-1 pt-0">
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div className="flex justify-between">
                <span>レイヤー:</span>
                <Badge variant="secondary" className="text-xs px-0.5 py-0 h-4">
                  {layers.length}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>表示中:</span>
                <Badge variant="secondary" className="text-xs px-0.5 py-0 h-4">
                  {visibleLayerCount}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>オブジェクト:</span>
                <Badge variant="secondary" className="text-xs px-0.5 py-0 h-4">
                  {artObjects.length}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>パス:</span>
                <Badge variant="outline" className="text-xs px-0.5 py-0 h-4">
                  {pathObjectCount}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-0.5">
          <CardHeader className="p-0 m-0">
            <CardTitle className="text-xs font-medium p-1 pb-0.5 m-0 leading-none">
              レイヤー
            </CardTitle>
          </CardHeader>
          <CardContent className="p-1 pt-0">
            <div className="space-y-0.5 max-h-24 overflow-y-auto">
              {layers.slice(0, 5).map((layer) => (
                <div
                  key={layer.id}
                  className="flex items-center justify-between text-xs p-0.5 rounded bg-muted/30"
                >
                  <div className="flex items-center gap-0.5">
                    <Badge
                      variant={layer.visible ? 'default' : 'secondary'}
                      className="text-xs px-0.5 py-0 h-3"
                    >
                      {layer.type.charAt(0)}
                    </Badge>
                    <code className="text-xs">{layer.id.slice(0, 4)}</code>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {layer.type === 'vector'
                      ? `${(layer as any).artObjectIds?.length || 0}`
                      : ''}
                  </div>
                </div>
              ))}
              {layers.length > 5 && (
                <div className="text-xs text-muted-foreground text-center">
                  +{layers.length - 5}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="p-0.5">
          <CardHeader className="p-0 m-0">
            <CardTitle className="text-xs font-medium p-1 pb-0.5 m-0 leading-none">
              オブジェクト
            </CardTitle>
          </CardHeader>
          <CardContent className="p-1 pt-0">
            <div className="space-y-0.5">
              {artObjects.slice(0, 5).map((obj) => (
                <div
                  key={obj.id}
                  className="flex items-center justify-between text-xs p-0.5 rounded bg-muted/30"
                >
                  <div className="flex items-center gap-0.5">
                    <Badge
                      variant={obj.visible ? 'default' : 'secondary'}
                      className="text-xs px-0.5 py-0 h-3"
                    >
                      {obj.type.charAt(0)}
                    </Badge>
                    <code className="text-xs">{obj.id.slice(0, 4)}</code>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {obj.type === 'path'
                      ? `${(obj as any).path?.points?.length || 0}pt`
                      : ''}
                  </div>
                </div>
              ))}
              {artObjects.length > 5 && (
                <div className="text-xs text-muted-foreground text-center">
                  +{artObjects.length - 5}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  },
)

DocumentStateSection.displayName = 'DocumentStateSection'
