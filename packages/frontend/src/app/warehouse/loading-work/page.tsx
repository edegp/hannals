'use client'

import { useState, useCallback, useEffect } from 'react'
import { CargoViewer } from '@/components/CargoViewer'
import { ItemsSidebar } from '@/components/ItemsSidebar'
import { PlacedItem, CargoArea, Truck } from '@/types'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, Truck as TruckIcon, CheckCircle } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

export default function LoadingWorkPage() {
  const [cargoArea, setCargoArea] = useState<CargoArea | null>(null)
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([])
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [maxOrder, setMaxOrder] = useState(10)
  const [currentLoadOrder, setCurrentLoadOrder] = useState(1)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    loadDemoPlan()
  }, [])

  const loadDemoPlan = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/demo/optimal/items`)
      if (response.ok) {
        const result = await response.json()
        setPlacedItems(result.items)

        const maxItemOrder = Math.max(...result.items.map((i: PlacedItem) => i.loadOrder ?? i.order), 1)
        setMaxOrder(maxItemOrder)
        setCurrentLoadOrder(1)

        if (result.items.length > 0) {
          const firstItem = result.items.find((i: PlacedItem) => (i.loadOrder ?? i.order) === 1)
          if (firstItem) {
            setSelectedItemId(firstItem.id)
          }
        }
      }
    } catch (error) {
      console.error('Failed to load demo plan:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const objUrl = '/trunkVoxel_cleaned.obj'
  const mtlUrl = '/trunkVoxel_2512131543.mtl'

  const handleCargoAreaDetected = useCallback((area: CargoArea) => {
    setCargoArea(area)
  }, [])

  const handleNextItem = () => {
    if (currentLoadOrder < maxOrder) {
      const nextOrder = currentLoadOrder + 1
      setCurrentLoadOrder(nextOrder)

      const nextItem = placedItems.find(i => (i.loadOrder ?? i.order) === nextOrder)
      if (nextItem) {
        setSelectedItemId(nextItem.id)
      }
    }
  }

  const handlePrevItem = () => {
    if (currentLoadOrder > 1) {
      const prevOrder = currentLoadOrder - 1
      setCurrentLoadOrder(prevOrder)

      const prevItem = placedItems.find(i => (i.loadOrder ?? i.order) === prevOrder)
      if (prevItem) {
        setSelectedItemId(prevItem.id)
      }
    }
  }

  const currentItem = placedItems.find(i => (i.loadOrder ?? i.order) === currentLoadOrder)
  const progressPercentage = maxOrder > 0 ? (currentLoadOrder / maxOrder) * 100 : 0

  // Split items into loaded (up to current) and pending
  const loadedItems = placedItems.filter(i => (i.loadOrder ?? i.order) < currentLoadOrder)
  const pendingItems = placedItems.filter(i => (i.loadOrder ?? i.order) > currentLoadOrder)

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <TruckIcon className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-xl font-semibold tracking-tight">積み込み作業支援</h1>
              <p className="text-sm text-muted-foreground">荷物リスト + 3D配置指示</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-base px-3 py-1">
              {currentLoadOrder} / {maxOrder}
            </Badge>

            <Button
              onClick={() => window.location.href = '/warehouse/loading-plan'}
              variant="outline"
              size="sm"
            >
              計画生成画面へ
            </Button>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">進捗</span>
            <span className="font-medium">{progressPercentage.toFixed(0)}%</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* 3D Viewer */}
        <div className="flex-1 relative">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                <div className="text-xl">読み込み中...</div>
              </div>
            </div>
          ) : (
            <>
              {/* Current Item Info */}
              {currentItem && (
                <div className="absolute top-4 left-4 z-10 bg-card px-6 py-4 rounded-lg border border-border shadow-lg">
                  <h3 className="font-semibold text-lg mb-2">次に積み込む荷物</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-8">
                      <span className="text-muted-foreground">荷物ID:</span>
                      <span className="font-medium">{currentItem.id}</span>
                    </div>
                    <div className="flex justify-between gap-8">
                      <span className="text-muted-foreground">サイズ:</span>
                      <span className="font-mono text-xs">
                        {currentItem.x_mm}×{currentItem.y_mm}×{currentItem.z_mm}mm
                      </span>
                    </div>
                    <div className="flex justify-between gap-8">
                      <span className="text-muted-foreground">配送順:</span>
                      <Badge variant="secondary">Stop {currentItem.order}</Badge>
                    </div>
                    {currentItem.fragile && (
                      <Badge variant="destructive">割れ物注意</Badge>
                    )}
                  </div>
                </div>
              )}

              <CargoViewer
                objUrl={objUrl}
                mtlUrl={mtlUrl}
                placedItems={loadedItems}
                selectedItemId={selectedItemId}
                onItemSelect={setSelectedItemId}
                cargoArea={cargoArea}
                entranceDirection={null}
                isSelectingEntrance={false}
                onEntranceClick={() => {}}
                onCargoAreaDetected={handleCargoAreaDetected}
                className="w-full h-full"
              />
            </>
          )}
        </div>

        {/* Sidebar */}
        {placedItems.length > 0 && (
          <ItemsSidebar
            items={pendingItems}
            completedItems={loadedItems}
            selectedItemId={selectedItemId}
            onItemSelect={setSelectedItemId}
            isOpen={sidebarOpen}
            onToggle={() => setSidebarOpen(!sidebarOpen)}
          />
        )}
      </div>

      {/* Control Panel */}
      {placedItems.length > 0 && (
        <div className="p-6 border-t border-border">
          <div className="max-w-md mx-auto">
            {currentLoadOrder >= maxOrder ? (
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-2 text-green-500">
                  <CheckCircle className="h-6 w-6" />
                  <span className="font-semibold text-lg">すべての荷物の積み込みが完了しました</span>
                </div>
                <Button
                  onClick={() => window.location.href = '/driver/departures'}
                  size="lg"
                >
                  配送画面へ
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-4">
                <Button
                  onClick={handlePrevItem}
                  disabled={currentLoadOrder <= 1}
                  variant="outline"
                  size="lg"
                >
                  <ChevronLeft className="h-5 w-5 mr-1" />
                  前の荷物
                </Button>

                <Badge variant="secondary" className="text-lg px-6 py-2">
                  {currentLoadOrder} / {maxOrder}
                </Badge>

                <Button
                  onClick={handleNextItem}
                  disabled={currentLoadOrder >= maxOrder}
                  size="lg"
                >
                  次の荷物
                  <ChevronRight className="h-5 w-5 ml-1" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
