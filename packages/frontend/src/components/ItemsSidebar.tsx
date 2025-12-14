'use client'

import { useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { PlacedItem, ViewerMode } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Check, Undo2, Package, MapPin, ListOrdered, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ItemsSidebarProps {
  items: PlacedItem[]
  completedItems?: PlacedItem[]
  selectedItemId: string | null
  highlightedItemId?: string | null
  onItemSelect: (id: string | null) => void
  isOpen?: boolean
  onToggle?: () => void
  mode?: ViewerMode
  onStatusChange?: (itemId: string) => void
  onStatusUndo?: (itemId: string) => void
}

function ItemPreview({ item }: { item: PlacedItem }) {
  const scale = 0.01
  const width = item.x_mm * scale
  const depth = item.y_mm * scale
  const height = item.z_mm * scale
  const color = item.fragile ? '#ef4444' : '#3b82f6'

  return (
    <mesh>
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

export function ItemsSidebar({ items, completedItems = [], selectedItemId, highlightedItemId, onItemSelect, isOpen = true, onToggle, mode, onStatusChange, onStatusUndo }: ItemsSidebarProps) {
  const allItems = [...items, ...completedItems]
  const selectedItem = allItems.find(item => item.id === selectedItemId)
  const getItemOrder = (item: PlacedItem) => (mode === 'delivery' ? item.order : (item.loadOrder ?? item.order))

  const scrollAreaRef = useRef<HTMLDivElement | null>(null)
  const pendingHeaderRef = useRef<HTMLHeadingElement | null>(null)
  const completedHeaderRef = useRef<HTMLHeadingElement | null>(null)

  const scrollToPending = () => {
    pendingHeaderRef.current?.scrollIntoView({ block: 'start' })
  }

  const scrollToCompleted = () => {
    completedHeaderRef.current?.scrollIntoView({ block: 'start' })
  }

  const undoLabel = mode === 'loading' ? '積み込み取消' : '配送取消'

  const resolveUndoTargetId = () => {
    if (!mode || !onStatusUndo || completedItems.length === 0) return null

    const selectedCompleted = selectedItemId
      ? completedItems.find((i) => i.id === selectedItemId)
      : undefined

    if (selectedCompleted) return selectedCompleted.id

    const getCompletedAtMs = (item: PlacedItem) => {
      const dateStr = mode === 'loading' ? item.loadedAt : item.deliveredAt
      const ms = dateStr ? Date.parse(dateStr) : NaN
      return Number.isFinite(ms) ? ms : -1
    }

    let latest = completedItems[0]
    let latestMs = getCompletedAtMs(latest)
    for (const item of completedItems) {
      const ms = getCompletedAtMs(item)
      if (ms > latestMs) {
        latest = item
        latestMs = ms
      }
    }

    return latest?.id ?? null
  }

  const sidebarContent = (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">アイテム情報</h2>
          </div>
          {mode && onStatusUndo && completedItems.length > 0 && (
            <Button
              onClick={() => {
                const targetId = resolveUndoTargetId()
                if (targetId) onStatusUndo(targetId)
              }}
              variant="ghost"
              size="sm"
            >
              <Undo2 className="h-4 w-4 mr-1" />
              {undoLabel}
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          待機中: {items.length} / 完了: {completedItems.length}
        </p>

        {(items.length > 0 || completedItems.length > 0) && (
          <div className="mt-3 flex gap-2">
            {items.length > 0 && (
              <Button
                onClick={scrollToPending}
                variant="outline"
                size="sm"
              >
                {mode === 'loading' ? '積み込み待ち' : mode === 'delivery' ? '配送待ち' : '一覧'}
              </Button>
            )}
            {completedItems.length > 0 && (
              <Button
                onClick={scrollToCompleted}
                variant="outline"
                size="sm"
              >
                {mode === 'loading' ? '積み込み済み' : mode === 'delivery' ? '配送済み' : '完了'}
              </Button>
            )}
          </div>
        )}
      </div>

      {selectedItem ? (
        <div className="p-4 border-b border-border">
          <Button
            onClick={() => onItemSelect(null)}
            variant="ghost"
            size="sm"
            className="mb-3"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            一覧に戻る
          </Button>

          <div className="space-y-3">
            <div>
              <h3 className="font-medium">{selectedItem.name || selectedItem.id}</h3>
              <p className="text-xs text-muted-foreground truncate">{selectedItem.id}</p>
            </div>

            <div className="h-32 bg-muted rounded-lg overflow-hidden">
              <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
                <ambientLight intensity={0.7} />
                <directionalLight position={[5, 5, 5]} />
                <ItemPreview item={selectedItem} />
                <OrbitControls enableZoom={false} />
              </Canvas>
            </div>

            <div className="space-y-2 text-sm">
              {selectedItem.destination && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    配送先
                  </span>
                  <Badge variant="secondary">{selectedItem.destination}</Badge>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">サイズ (mm)</span>
                <span className="font-mono text-xs">
                  {selectedItem.x_mm} × {selectedItem.y_mm} × {selectedItem.z_mm}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">重量</span>
                <span>{selectedItem.weight_kg} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">配送順</span>
                <span>#{selectedItem.order}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">積込順</span>
                <span>#{selectedItem.loadOrder ?? '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">壊れ物</span>
                <Badge variant={selectedItem.fragile ? 'destructive' : 'outline'}>
                  {selectedItem.fragile ? 'はい' : 'いいえ'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">位置 (mm)</span>
                <span className="font-mono text-xs">
                  ({selectedItem.posX.toFixed(0)}, {selectedItem.posY.toFixed(0)}, {selectedItem.posZ.toFixed(0)})
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 text-center text-muted-foreground">
          アイテムを選択してください
        </div>
      )}

      <div ref={scrollAreaRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-2">
          {/* Pending Items */}
          <h3 ref={pendingHeaderRef} className="text-sm font-medium text-muted-foreground px-2 mb-2 flex items-center gap-2">
            <ListOrdered className="h-4 w-4" />
            {mode === 'loading' ? '積み込み待ち' : mode === 'delivery' ? '配送待ち' : 'アイテム一覧'}
            {items.length > 0 && <span className="text-xs">({items.length})</span>}
          </h3>

          {items.map((item) => (
            <div key={item.id} className="mb-2">
              <Card
                className={cn(
                  'cursor-pointer transition-colors hover:bg-accent',
                  item.id === selectedItemId && 'ring-2 ring-primary',
                  item.id === highlightedItemId && 'ring-2 ring-yellow-400 bg-yellow-50 dark:bg-yellow-950'
                )}
                onClick={() => onItemSelect(item.id)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate">{item.name || item.id}</span>
                    <Badge variant={item.id === highlightedItemId ? 'default' : 'outline'} className={cn('ml-2', item.id === highlightedItemId && 'bg-yellow-400 text-yellow-900')}>
                      #{getItemOrder(item)}
                    </Badge>
                  </div>
                  {item.destination && (
                    <div className="text-xs text-amber-500 truncate mt-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {item.destination}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                    <span>{item.x_mm}×{item.y_mm}×{item.z_mm}mm</span>
                    <span>{item.weight_kg}kg</span>
                    {item.fragile && <Badge variant="destructive" className="text-[10px] px-1 py-0">壊れ物</Badge>}
                  </div>
                </CardContent>
              </Card>

              {mode && onStatusChange && (
                <Button
                  onClick={(e) => {
                    e.stopPropagation()
                    onStatusChange(item.id)
                  }}
                  className="w-full mt-1"
                  variant={mode === 'loading' ? 'default' : 'secondary'}
                  size="sm"
                >
                  <Check className="h-4 w-4 mr-1" />
                  {mode === 'loading' ? '積み込み完了' : '配送完了'}
                </Button>
              )}
            </div>
          ))}

          {/* Completed Items */}
          {completedItems.length > 0 && (
            <>
              <Separator className="my-4" />
              <h3 ref={completedHeaderRef} className="text-sm font-medium text-muted-foreground px-2 mb-2 flex items-center gap-2">
                <Check className="h-4 w-4" />
                {mode === 'loading' ? '積み込み済み' : mode === 'delivery' ? '配送済み' : '完了'}
                <span className="text-xs">({completedItems.length})</span>
              </h3>

              {completedItems.map((item) => (
                <div key={item.id} className="mb-2">
                  <Card
                    className={cn(
                      'cursor-pointer transition-colors opacity-60',
                      item.id === selectedItemId && 'ring-2 ring-primary opacity-100'
                    )}
                    onClick={() => onItemSelect(item.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{item.name || item.id}</span>
                        <Check className="h-4 w-4 text-green-500" />
                      </div>
                      {item.destination && (
                        <div className="text-xs text-muted-foreground truncate mt-1 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {item.destination}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        {item.x_mm}×{item.y_mm}×{item.z_mm}mm / {item.weight_kg}kg
                      </div>
                    </CardContent>
                  </Card>

                  {mode && onStatusUndo && (
                    <Button
                      onClick={(e) => {
                        e.stopPropagation()
                        onStatusUndo(item.id)
                      }}
                      className="w-full mt-1"
                      variant="ghost"
                      size="sm"
                    >
                      <Undo2 className="h-4 w-4 mr-1" />
                      {mode === 'loading' ? '積み込み取消' : '配送取消'}
                    </Button>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile Toggle Button */}
      <Button
        onClick={onToggle}
        className="lg:hidden fixed bottom-32 right-4 z-50 rounded-full h-12 w-12"
        size="icon"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Package className="h-5 w-5" />}
      </Button>

      {/* Responsive Sidebar */}
      <div
        className={cn(
          'w-80 bg-card border-l border-border flex flex-col h-full overflow-hidden transition-transform duration-300',
          // Mobile: fixed position with slide animation
          'fixed right-0 top-0 bottom-0 z-40 transform',
          isOpen ? 'translate-x-0' : 'translate-x-full',
          // Desktop: static position, no transform
          'lg:static lg:z-auto lg:transform-none lg:flex-shrink-0',
          !isOpen && 'lg:hidden'
        )}
      >
        {sidebarContent}
      </div>
    </>
  )
}
