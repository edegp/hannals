'use client'

import { useState, useCallback, useEffect } from 'react'
import { CargoViewer } from '@/components/CargoViewer'
import { OrderSlider } from '@/components/OrderSlider'
import { ItemsSidebar } from '@/components/ItemsSidebar'
import { TruckUploader } from '@/components/TruckUploader'
import { TruckSelector } from '@/components/TruckSelector'
import { ImageDimensionExtractor } from '@/components/ImageDimensionExtractor'
import { CsvImporter } from '@/components/CsvImporter'
import { PlacedItem, CargoArea, ClickPoint, Item, Truck } from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

// サンプル荷物データ
const sampleItems: Item[] = [
  { id: 'A001', x_mm: 600, y_mm: 400, z_mm: 300, order: 3, weight_kg: 12.5, fragile: false, rot_xy: true },
  { id: 'B010', x_mm: 205, y_mm: 195, z_mm: 180, order: 1, weight_kg: 5.2, fragile: true, rot_xy: false },
  { id: 'C003', x_mm: 400, y_mm: 300, z_mm: 250, order: 2, weight_kg: 8.0, fragile: false, rot_xy: true },
  { id: 'D005', x_mm: 350, y_mm: 280, z_mm: 200, order: 4, weight_kg: 6.5, fragile: false, rot_xy: true },
]

// 入り口方向
type EntranceDirection = 'front' | 'back' | 'left' | 'right' | null

export default function Home() {
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null)
  const [cargoArea, setCargoArea] = useState<CargoArea | null>(null)
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([])
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [maxOrder, setMaxOrder] = useState(10)
  const [entranceDirection, setEntranceDirection] = useState<EntranceDirection>(null)
  const [entrancePoint, setEntrancePoint] = useState<ClickPoint | null>(null)
  const [isSelectingEntrance, setIsSelectingEntrance] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showUploader, setShowUploader] = useState(false)
  const [showDimensionExtractor, setShowDimensionExtractor] = useState(false)
  const [showCsvImporter, setShowCsvImporter] = useState(false)
  const [inputItems, setInputItems] = useState<Item[]>(sampleItems)

  // 荷台のOBJ/MTL URLを生成
  const objUrl = selectedTruck ? `${API_URL}/api/trucks/${selectedTruck.id}/obj` : '/trunkVoxel_cleaned.obj'
  const mtlUrl = selectedTruck?.mtlFilePath ? `${API_URL}/api/trucks/${selectedTruck.id}/mtl` : '/trunkVoxel_2512131543.mtl'

  // 荷台選択時の処理
  const handleTruckSelect = useCallback((truck: Truck) => {
    setSelectedTruck(truck)
    setEntranceDirection(truck.entranceDirection as EntranceDirection)
    setPlacedItems([])
    setSelectedItemId(null)

    // 荷台のバウンディングボックスを設定
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

  // 荷台アップロード完了時の処理
  const handleTruckUpload = useCallback((truck: Truck) => {
    setShowUploader(false)
    handleTruckSelect(truck)
  }, [handleTruckSelect])

  // 荷台のバウンディングボックスを受け取る（自動検出）
  const handleCargoAreaDetected = useCallback((area: CargoArea) => {
    setCargoArea(area)
  }, [])

  // 入り口位置のクリック処理
  const handleEntranceClick = useCallback((point: ClickPoint) => {
    if (!isSelectingEntrance || !cargoArea) return

    setEntrancePoint(point)

    // クリック位置から入り口方向を判定
    const centerX = (cargoArea.minX + cargoArea.maxX) / 2
    const centerY = (cargoArea.minY + cargoArea.maxY) / 2
    const dx = point.x - centerX
    const dy = point.y - centerY

    let direction: EntranceDirection
    if (Math.abs(dx) > Math.abs(dy)) {
      direction = dx > 0 ? 'right' : 'left'
    } else {
      direction = dy > 0 ? 'front' : 'back'
    }
    setEntranceDirection(direction)
    setIsSelectingEntrance(false)

    // 荷台の入り口方向を更新
    if (selectedTruck) {
      updateTruckEntranceDirection(selectedTruck.id, direction)
    }
  }, [isSelectingEntrance, cargoArea, selectedTruck])

  // 入り口方向をAPIで更新
  const updateTruckEntranceDirection = async (truckId: string, direction: string) => {
    try {
      await fetch(`${API_URL}/api/trucks/${truckId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entranceDirection: direction }),
      })
    } catch (error) {
      console.error('Failed to update entrance direction:', error)
    }
  }

  // 画像から抽出された荷物を設定
  const handleItemsExtracted = useCallback((items: Item[]) => {
    setInputItems(items)
    setShowDimensionExtractor(false)
  }, [])

  // CSVからインポートされた荷物を設定
  const handleItemsImported = useCallback((items: Item[]) => {
    setInputItems(items)
    setShowCsvImporter(false)
  }, [])

  // 荷物を配置（外部API経由）
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
        const maxItemOrder = Math.max(...result.placement.items.map((i: PlacedItem) => i.order), 1)
        setMaxOrder(maxItemOrder)
      }
    } catch (error) {
      console.error('Failed to place items:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // リセット
  const handleReset = () => {
    setSelectedTruck(null)
    setCargoArea(null)
    setPlacedItems([])
    setEntranceDirection(null)
    setEntrancePoint(null)
  }

  const maxItemOrder = placedItems.length > 0
    ? Math.max(...placedItems.map(i => i.order))
    : 1

  const getDirectionLabel = (dir: EntranceDirection) => {
    switch (dir) {
      case 'front': return '前方'
      case 'back': return '後方'
      case 'left': return '左側'
      case 'right': return '右側'
      default: return '未設定'
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* ヘッダー */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-white">荷台3Dビューアー</h1>
            <TruckSelector
              selectedTruck={selectedTruck}
              onSelect={handleTruckSelect}
              onAddNew={() => setShowUploader(true)}
            />
          </div>

          <div className="flex items-center gap-4">
            {selectedTruck && cargoArea && (
              <>
                <span className="text-gray-400 text-sm">
                  積載領域: {((cargoArea.maxX - cargoArea.minX) / 1000).toFixed(1)}m x
                  {((cargoArea.maxY - cargoArea.minY) / 1000).toFixed(1)}m x
                  {((cargoArea.maxZ - cargoArea.minZ) / 1000).toFixed(1)}m
                </span>

                <button
                  onClick={() => setIsSelectingEntrance(true)}
                  className={`px-4 py-2 rounded ${
                    isSelectingEntrance ? 'bg-yellow-500' : 'bg-purple-500'
                  } text-white`}
                >
                  {isSelectingEntrance ? 'クリックで入り口を指定...' : `入り口: ${getDirectionLabel(entranceDirection)}`}
                </button>

                <button
                  onClick={() => setShowDimensionExtractor(true)}
                  className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-400"
                >
                  画像から荷物追加
                </button>

                <button
                  onClick={() => setShowCsvImporter(true)}
                  className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-500"
                >
                  CSVインポート ({inputItems.length})
                </button>

                <button
                  onClick={handlePlaceItems}
                  disabled={isLoading || inputItems.length === 0}
                  className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
                >
                  荷物を配置
                </button>

                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-red-500 text-white rounded"
                >
                  リセット
                </button>
              </>
            )}
          </div>
        </div>
        {isSelectingEntrance && (
          <p className="text-sm text-yellow-400 mt-2">
            荷台の入り口（積み込み口）の位置をクリックしてください
          </p>
        )}
      </header>

      {/* メインコンテンツ */}
      <div className="flex-1 flex overflow-hidden">
        {/* 3Dビューアー */}
        <div className="flex-1 relative">
          <CargoViewer
            objUrl={objUrl}
            mtlUrl={mtlUrl}
            placedItems={placedItems}
            selectedItemId={selectedItemId}
            onItemSelect={setSelectedItemId}
            maxOrder={maxOrder}
            cargoArea={cargoArea}
            entrancePoint={entrancePoint}
            entranceDirection={entranceDirection}
            isSelectingEntrance={isSelectingEntrance}
            onEntranceClick={handleEntranceClick}
            onCargoAreaDetected={handleCargoAreaDetected}
            className="w-full h-full"
          />
        </div>

        {/* サイドバー */}
        {placedItems.length > 0 && (
          <ItemsSidebar
            items={placedItems}
            selectedItemId={selectedItemId}
            onItemSelect={setSelectedItemId}
            maxOrder={maxOrder}
          />
        )}
      </div>

      {/* スライダー */}
      {placedItems.length > 0 && (
        <div className="p-4 bg-gray-800 border-t border-gray-700">
          <OrderSlider
            min={1}
            max={maxItemOrder}
            value={maxOrder}
            onChange={setMaxOrder}
          />
        </div>
      )}

      {/* アップローダーモーダル */}
      {showUploader && (
        <TruckUploader
          onUpload={handleTruckUpload}
          onCancel={() => setShowUploader(false)}
        />
      )}

      {/* 寸法抽出モーダル */}
      {showDimensionExtractor && (
        <ImageDimensionExtractor
          onItemsExtracted={handleItemsExtracted}
          onClose={() => setShowDimensionExtractor(false)}
        />
      )}

      {/* CSVインポートモーダル */}
      {showCsvImporter && (
        <CsvImporter
          onItemsImported={handleItemsImported}
          onClose={() => setShowCsvImporter(false)}
        />
      )}
    </div>
  )
}
