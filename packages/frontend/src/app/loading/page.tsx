'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { CargoViewer } from '@/components/CargoViewer'
import { ItemsSidebar } from '@/components/ItemsSidebar'
import { TruckSelector } from '@/components/TruckSelector'
import { CsvImporter } from '@/components/CsvImporter'
import { PlacedItem, CargoArea, Item, Truck } from '@/types'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Truck as TruckIcon, Package, RotateCcw, FileSpreadsheet, Play } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

type EntranceDirection = 'front' | 'back' | 'left' | 'right' | null

export default function LoadingPage() {
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null)
  const [cargoArea, setCargoArea] = useState<CargoArea | null>(null)
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([])
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [entranceDirection, setEntranceDirection] = useState<EntranceDirection>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showCsvImporter, setShowCsvImporter] = useState(false)
  const [inputItems, setInputItems] = useState<Item[]>([])
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

  const handleItemsImported = useCallback((items: Item[]) => {
    setInputItems(items)
    setShowCsvImporter(false)
  }, [])

  const handlePlaceItems = async () => {
    if (!selectedTruck || inputItems.length === 0) return

    setIsLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/placements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          truckId: selectedTruck.id,
          items: inputItems,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        setPlacedItems(result.placement.items)
      }
    } catch (error) {
      console.error('Failed to place items:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLoadDemo = async () => {
    if (!selectedTruck) return

    setIsLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/demo/optimal/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ truckId: selectedTruck.id }),
      })
      if (response.ok) {
        const result = await response.json()
        setPlacedItems(result.items)
      }
    } catch (error) {
      console.error('Failed to load demo:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleMarkLoaded = async (itemId: string) => {
    let previousLoadedAt: string | undefined
    const nextLoadedAt = new Date().toISOString()

    setPlacedItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      previousLoadedAt = item.loadedAt
      return { ...item, isLoaded: true, loadedAt: nextLoadedAt }
    }))

    try {
      const response = await fetch(`${API_URL}/api/items/${itemId}/load`, {
        method: 'PATCH',
      })
      if (!response.ok) {
        throw new Error('API response not ok')
      }
    } catch {
      setPlacedItems(prev => prev.map(item =>
        item.id === itemId ? { ...item, isLoaded: false, loadedAt: previousLoadedAt } : item
      ))
      window.alert('サーバーへの反映に失敗しました。もう一度お試しください。')
    }
  }

  const handleUnload = async (itemId: string) => {
    let previousLoadedAt: string | undefined

    setPlacedItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      previousLoadedAt = item.loadedAt
      return { ...item, isLoaded: false, loadedAt: undefined }
    }))

    try {
      const response = await fetch(`${API_URL}/api/items/${itemId}/unload`, {
        method: 'PATCH',
      })
      if (!response.ok) {
        throw new Error('API response not ok')
      }
    } catch {
      setPlacedItems(prev => prev.map(item =>
        item.id === itemId ? { ...item, isLoaded: true, loadedAt: previousLoadedAt } : item
      ))
      window.alert('サーバーへの反映に失敗しました。もう一度お試しください。')
    }
  }

  const handleReset = () => {
    setPlacedItems([])
    setInputItems([])
  }

  const loadedItems = placedItems.filter(item => item.isLoaded)

  const pendingItems = placedItems
    .filter(item => !item.isLoaded)
    .sort((a, b) => {
      if (a.posY !== b.posY) return b.posY - a.posY
      return a.posX - b.posX
    })

  const loadedCount = placedItems.filter(item => item.isLoaded).length
  const progressPercent = placedItems.length > 0 ? (loadedCount / placedItems.length) * 100 : 0

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <TruckIcon className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-semibold tracking-tight">積み込み</h1>
              </div>

              <TruckSelector
                selectedTruck={selectedTruck}
                onSelect={handleTruckSelect}
              />

              {/* Navigation */}
              <nav className="flex gap-1">
                <Button variant="secondary" size="sm">
                  積み込み
                </Button>
                <Link href="/delivery">
                  <Button variant="ghost" size="sm" className="text-muted-foreground">
                    配送
                  </Button>
                </Link>
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
                    onClick={() => setShowCsvImporter(true)}
                    variant="outline"
                    size="sm"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    CSV ({inputItems.length})
                  </Button>

                  <Button
                    onClick={handlePlaceItems}
                    disabled={isLoading || inputItems.length === 0}
                    variant="default"
                    size="sm"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    配置
                  </Button>

                  <Button
                    onClick={handleLoadDemo}
                    disabled={isLoading}
                    size="sm"
                  >
                    <Package className="h-4 w-4 mr-2" />
                    デモ
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
                <span className="text-muted-foreground">積み込み進捗</span>
                <span className="font-medium">{loadedCount} / {placedItems.length}</span>
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
              placedItems={loadedItems}
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
          items={pendingItems}
          completedItems={loadedItems}
          selectedItemId={selectedItemId}
          onItemSelect={setSelectedItemId}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          mode="loading"
          onStatusChange={handleMarkLoaded}
          onStatusUndo={handleUnload}
        />
      )}

      {/* CSV Import Modal */}
      {showCsvImporter && (
        <CsvImporter
          onItemsImported={handleItemsImported}
          onClose={() => setShowCsvImporter(false)}
        />
      )}
    </div>
  )
}
