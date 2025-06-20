'use client'

import { memo } from 'react'
import { useSnapshot } from 'valtio'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { selectionState } from '@/engine/selection-state'
import { editorState, getActiveDocument } from '@/stores/editor'
import {
  Appearance,
  isStrokeAppearance,
  isFillAppearance,
} from '@/engine/document/appearance'
import { Palette, Move, Eye, Layers } from 'lucide-react'

export interface ObjectPropertiesPanelProps {
  className?: string
}

export const ObjectPropertiesPanel = memo(function ObjectPropertiesPanel({
  className,
}: ObjectPropertiesPanelProps) {
  const selection = useSnapshot(selectionState)
  const editor = useSnapshot(editorState)
  const document = getActiveDocument()

  const selectedObjects = Array.from(selection.selectedObjects || [])
    .map((id: string) => document?.artObjects?.[id])
    .filter(Boolean)

  const selectedObject = selectedObjects[0]

  if (!selectedObject) {
    return (
      <Card className={className}>
        <CardHeader className="p-2">
          <CardTitle className="text-sm flex items-center gap-1">
            <Layers className="w-3 h-3" />
            プロパティ
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div className="text-xs text-muted-foreground text-center py-4">
            オブジェクトを選択してください
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="p-2">
        <CardTitle className="text-sm flex items-center gap-1">
          <Layers className="w-3 h-3" />
          プロパティ
        </CardTitle>
      </CardHeader>
      <CardContent className="p-1">
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-6">
            <TabsTrigger value="general" className="text-xs px-1">
              一般
            </TabsTrigger>
            <TabsTrigger value="appearance" className="text-xs px-1">
              外観
            </TabsTrigger>
            <TabsTrigger value="transform" className="text-xs px-1">
              変形
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-2 mt-2">
            <div className="space-y-1">
              <Label className="text-xs">名前</Label>
              <Input
                value={selectedObject.name}
                className="h-6 text-xs"
                placeholder="オブジェクト名"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">種類</Label>
              <Badge variant="outline" className="text-xs">
                {selectedObject.type === 'path' ? 'パス' : 'グループ'}
              </Badge>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="visible"
                checked={selectedObject.visible !== false}
                className="scale-75"
              />
              <Label
                htmlFor="visible"
                className="text-xs flex items-center gap-1"
              >
                <Eye className="w-3 h-3" />
                表示
              </Label>
            </div>

            {selectedObject.type === 'path' && selectedObject.path && (
              <div className="space-y-1">
                <Label className="text-xs">ポイント数</Label>
                <div className="text-xs text-muted-foreground">
                  {(selectedObject.path.points || []).length}個
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="appearance" className="space-y-2 mt-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">アピアランス</Label>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-5 text-xs px-1"
                >
                  追加
                </Button>
              </div>

              <div className="space-y-1">
                {(selectedObject.appearances || []).map(
                  (appearance: any, index: number) => (
                    <AppearanceItem
                      key={appearance.uid}
                      appearance={appearance}
                      index={index}
                    />
                  ),
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="transform" className="space-y-2 mt-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">X</Label>
                <Input type="number" className="h-6 text-xs" placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Y</Label>
                <Input type="number" className="h-6 text-xs" placeholder="0" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">幅</Label>
                <Input
                  type="number"
                  className="h-6 text-xs"
                  placeholder="100"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">高さ</Label>
                <Input
                  type="number"
                  className="h-6 text-xs"
                  placeholder="100"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">回転</Label>
              <div className="space-y-1">
                <Slider value={[0]} max={360} step={1} className="w-full" />
                <div className="text-xs text-muted-foreground text-center">
                  0°
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">不透明度</Label>
              <div className="space-y-1">
                <Slider value={[100]} max={100} step={1} className="w-full" />
                <div className="text-xs text-muted-foreground text-center">
                  100%
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
})

interface AppearanceItemProps {
  appearance: Appearance
  index: number
}

const AppearanceItem = memo(function AppearanceItem({
  appearance,
  index,
}: AppearanceItemProps) {
  const getAppearanceLabel = () => {
    if (isStrokeAppearance(appearance)) {
      return `線 (${appearance.params.width}px)`
    }
    if (isFillAppearance(appearance)) {
      return appearance.params.fillType === 'solid' ? '塗り' : 'グラデーション'
    }
    return 'エフェクト'
  }

  const getAppearanceColor = () => {
    if (isStrokeAppearance(appearance)) {
      const color = appearance.params.color
      return `rgba(${Math.round(color.r * 255)}, ${Math.round(
        color.g * 255,
      )}, ${Math.round(color.b * 255)}, ${color.a})`
    }
    if (isFillAppearance(appearance) && appearance.params.color) {
      const color = appearance.params.color
      return `rgba(${Math.round(color.r * 255)}, ${Math.round(
        color.g * 255,
      )}, ${Math.round(color.b * 255)}, ${color.a})`
    }
    return '#000000'
  }

  return (
    <div className="flex items-center gap-2 p-1 border rounded text-xs">
      <div
        className="w-4 h-4 rounded border"
        style={{ backgroundColor: getAppearanceColor() }}
      />
      <div className="flex-1">
        <div className="font-medium">{getAppearanceLabel()}</div>
        <div className="text-muted-foreground">
          {Math.round(appearance.params.opacity * 100)}% •{' '}
          {appearance.params.blendMode}
        </div>
      </div>
      <Switch checked={appearance.enabled} className="scale-75" />
    </div>
  )
})
