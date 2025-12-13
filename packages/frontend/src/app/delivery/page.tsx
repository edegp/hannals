'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { CargoViewer } from '@/components/CargoViewer'
import { ItemsSidebar } from '@/components/ItemsSidebar'
import { TruckSelector } from '@/components/TruckSelector'
import { PlacedItem, CargoArea, Truck } from '@/types'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Truck as TruckIcon, Package, RotateCcw } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

type EntranceDirection = 'front' | 'back' | 'left' | 'right' | null

export default function DeliveryPage() {
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null)
  const [cargoArea, setCargoArea] = useState<CargoArea | null>(null)
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([])
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [entranceDirection, setEntranceDirection] = useState<EntranceDirection>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const objUrl = selectedTruck ? `${API_URL}/api/trucks/${selectedTruck.id}/obj` : undefined
  const mtlUrl = selectedTruck?.mtlFilePath ? `${API_URL}/api/trucks/${selectedTruck.id}/mtl` : undefined

  const handleTruckSelect = useCallback((truck: Truck) => {
    setSelectedTruck(truck)
    setEntranceDirection(truck.entranceDirection as EntranceDirection)
    setPlacedItems([])
    setSelectedItemId(null)

    if (truck.minX !== null && truck.maxX !== null) {
      setCargoArea({
        id: truck.id,
        name: truck.name,
        minX: truck.minX,
        minY: truck.minY ?? 0,
        minZ: truck.minZ ?? 0,
        maxX: truck.maxX,
        maxY: truck.maxY ?? 0,
        maxZ: truck.maxZ ?? 0,
      })
    }
  }, [])

  useEffect(() => {
    const loadDefaultTruck = async () => {
      try {
        const response = await fetch(`${API_URL}/api/trucks`)
        if (response.ok) {
          const trucks: Truck[] = await response.json()
          const defaultTruck = trucks.find(t => t.name.includes('2t')) || trucks[0]
          if (defaultTruck) {
            handleTruckSelect(defaultTruck)
          }
        }
      } catch (error) {
        console.error('Failed to load trucks:', error)
      }
    }
    loadDefaultTruck()
  }, [handleTruckSelect])

  const handleLoadDemo = async () => {
    if (!selectedTruck) return

    setIsLoading(true)
    try {
      let loadedFromDb = false

      try {
        const placementsRes = await fetch(`${API_URL}/api/placements`)
        if (placementsRes.ok) {
          const placements: Array<{ id: string; truckId: string }> = await placementsRes.json()
          const latest = placements.find((p) => p.truckId === selectedTruck.id)
          if (latest) {
            const detailRes = await fetch(`${API_URL}/api/placements/${latest.id}`)
            if (detailRes.ok) {
              const placement = await detailRes.json()
              const items: PlacedItem[] = placement?.items ?? []
              setPlacedItems(items)
              loadedFromDb = true
            }
          }
        }
      } catch {
        // ignore
      }

      if (!loadedFromDb) {
        const response = await fetch(`${API_URL}/api/demo/optimal/load`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ truckId: selectedTruck.id }),
        })
        if (response.ok) {
          const result = await response.json()
          const itemsWithLoadedStatus = result.items.map((item: PlacedItem) => ({
            ...item,
            isLoaded: true,
            isDelivered: false,
          }))

          const updateResponse = await fetch(`${API_URL}/api/items/load`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemIds: result.items.map((item: PlacedItem) => item.id) }),
          })
          if (!updateResponse.ok) {
            throw new Error('Failed to batch-update loaded items')
          }

          setPlacedItems(itemsWithLoadedStatus)
        }
      }
    } catch (error) {
      console.error('Failed to load demo:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleMarkDelivered = async (itemId: string) => {
    let previousDeliveredAt: string | undefined
    const nextDeliveredAt = new Date().toISOString()

    setPlacedItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      previousDeliveredAt = item.deliveredAt
      return { ...item, isDelivered: true, deliveredAt: nextDeliveredAt }
    }))

    try {
      const response = await fetch(`${API_URL}/api/items/${itemId}/deliver`, {
        method: 'PATCH',
      })
      if (!response.ok) {
        throw new Error('API request failed')
      }
    } catch {
      setPlacedItems(prev => prev.map(item =>
        item.id === itemId ? { ...item, isDelivered: false, deliveredAt: previousDeliveredAt } : item
      ))
      window.alert('配送済みにできませんでした。ネットワークまたはサーバーエラーが発生しました。')
    }
  }

  const handleUndeliver = async (itemId: string) => {
    let previousDeliveredAt: string | undefined

    setPlacedItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      previousDeliveredAt = item.deliveredAt
      return { ...item, isDelivered: false, deliveredAt: undefined }
    }))

    try {
      const response = await fetch(`${API_URL}/api/items/${itemId}/undeliver`, {
        method: 'PATCH',
      })
      if (!response.ok) {
        throw new Error('API request failed')
      }
    } catch {
      setPlacedItems(prev => prev.map(item =>
        item.id === itemId ? { ...item, isDelivered: true, deliveredAt: previousDeliveredAt } : item
      ))
      window.alert('配送取消にできませんでした。ネットワークまたはサーバーエラーが発生しました。')
    }
  }

  const handleReset = () => {
    setPlacedItems([])
  }

  const pendingDeliveryItems = placedItems
    .filter(item => item.isLoaded && !item.isDelivered)
    .sort((a, b) => a.order - b.order)

  const deliveredItems = placedItems
    .filter(item => item.isDelivered)
    .sort((a, b) => a.order - b.order)

  const deliveredCount = placedItems.filter(item => item.isDelivered).length
  const totalLoadedCount = placedItems.filter(item => item.isLoaded).length
  const progressPercent = totalLoadedCount > 0 ? (deliveredCount / totalLoadedCount) * 100 : 0

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <TruckIcon className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-semibold tracking-tight">配送</h1>
              </div>

              <TruckSelector
                selectedTruck={selectedTruck}
                onSelect={handleTruckSelect}
              />

              {/* Navigation */}
              <nav className="flex gap-1">
                <Link href="/loading">
                  <Button variant="ghost" size="sm" className="text-muted-foreground">
                    積み込み
                  </Button>
                </Link>
                <Button variant="secondary" size="sm">
                  配送
                </Button>
              </nav>
            </div>

            <div className="flex items-center gap-3">
              {selectedTruck && cargoArea && (
                <>
                  <Badge variant="outline" className="font-normal">
                    {((cargoArea.maxX - cargoArea.minX) / 1000).toFixed(1)}m ×
                    {((cargoArea.maxY - cargoArea.minY) / 1000).toFixed(1)}m ×
                    {((cargoArea.maxZ - cargoArea.minZ) / 1000).toFixed(1)}m
                  </Badge>

                  <Button
                    onClick={handleLoadDemo}
                    disabled={isLoading}
                    size="sm"
                  >
                    <Package className="h-4 w-4 mr-2" />
                    デモ読込
                  </Button>

                  <Button
                    onClick={handleReset}
                    variant="destructive"
                    size="sm"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    リセット
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Progress */}
          {placedItems.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">配送進捗</span>
                <span className="font-medium">{deliveredCount} / {totalLoadedCount}</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          )}
        </header>

        {/* 3D Viewer */}
        <div className="flex-1 relative overflow-hidden">
          {objUrl && (
            <CargoViewer
              objUrl={objUrl}
              mtlUrl={mtlUrl}
              placedItems={pendingDeliveryItems}
              selectedItemId={selectedItemId}
              onItemSelect={setSelectedItemId}
              cargoArea={cargoArea}
              entrancePoint={null}
              entranceDirection={entranceDirection}
              isSelectingEntrance={false}
              onEntranceClick={() => { }}
              onCargoAreaDetected={() => { }}
              className="w-full h-full"
            />
          )}
        </div>
      </div>

      {/* Sidebar */}
      {placedItems.length > 0 && (
        <ItemsSidebar
          items={pendingDeliveryItems}
          completedItems={deliveredItems}
          selectedItemId={selectedItemId}
          onItemSelect={setSelectedItemId}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          mode="delivery"
          onStatusChange={handleMarkDelivered}
          onStatusUndo={handleUndeliver}
        />
      )}
    </div>
  )
}
