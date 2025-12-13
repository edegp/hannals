'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { CargoViewer } from '@/components/CargoViewer'
import { OrderSlider } from '@/components/OrderSlider'
import { ItemsSidebar } from '@/components/ItemsSidebar'
import { TruckSelector } from '@/components/TruckSelector'
import { PlacedItem, CargoArea, Truck } from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

// 入り口方向
type EntranceDirection = 'front' | 'back' | 'left' | 'right' | null

export default function DeliveryPage() {
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null)
  const [cargoArea, setCargoArea] = useState<CargoArea | null>(null)
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([])
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [maxOrder, setMaxOrder] = useState(10)
  const [entranceDirection, setEntranceDirection] = useState<EntranceDirection>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // 荷台のOBJ/MTL URLを生成
  const objUrl = selectedTruck ? `${API_URL}/api/trucks/${selectedTruck.id}/obj` : undefined
  const mtlUrl = selectedTruck?.mtlFilePath ? `${API_URL}/api/trucks/${selectedTruck.id}/mtl` : undefined

  // 荷台選択時の処理
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

  // 初回読み込み時に2tトラックを自動選択
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

  // デモ配置を読み込む（データベースに保存、配送画面では全て積み込み済みとして扱う）
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
        // デモデータは全て積み込み済みとしてマーク
        const itemsWithLoadedStatus = result.items.map((item: PlacedItem) => ({
          ...item,
          isLoaded: true,
          isDelivered: false,
        }))
        setPlacedItems(itemsWithLoadedStatus)

        // まとめて積み込み済みとしてDBに更新
        await fetch(`${API_URL}/api/items/load`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemIds: result.items.map((item: PlacedItem) => item.id) }),
        })

        const maxItemOrder = Math.max(...result.items.map((i: PlacedItem) => i.order), 1)
        setMaxOrder(maxItemOrder)
      }
    } catch (error) {
      console.error('Failed to load demo:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 配送済みにする
  const handleMarkDelivered = async (itemId: string) => {
    // ローカル状態を更新
    setPlacedItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, isDelivered: true, deliveredAt: new Date().toISOString() } : item
    ))

    // APIにも送信
    try {
      await fetch(`${API_URL}/api/items/${itemId}/deliver`, {
        method: 'PATCH',
      })
    } catch (error) {
      // エラーは無視
    }
  }

  // 配送取消
  const handleUndeliver = async (itemId: string) => {
    // ローカル状態を更新
    setPlacedItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, isDelivered: false, deliveredAt: undefined } : item
    ))

    // APIにも送信
    try {
      await fetch(`${API_URL}/api/items/${itemId}/undeliver`, {
        method: 'PATCH',
      })
    } catch (error) {
      // エラーは無視
    }
  }

  // リセット
  const handleReset = () => {
    setPlacedItems([])
  }

  // 配送待ちアイテム（積み込み済みかつ配送済みでない）
  const pendingDeliveryItems = placedItems
    .filter(item => item.isLoaded && !item.isDelivered)
    .sort((a, b) => a.order - b.order)  // order順（小さい順 = 先に配送）

  // 配送済みアイテム
  const deliveredItems = placedItems
    .filter(item => item.isDelivered)
    .sort((a, b) => a.order - b.order)

  const maxItemOrder = placedItems.length > 0
    ? Math.max(...placedItems.map(i => i.order))
    : 1

  const deliveredCount = placedItems.filter(item => item.isDelivered).length
  const totalLoadedCount = placedItems.filter(item => item.isLoaded).length

  return (
    <div className="h-screen flex bg-gray-900 overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* ヘッダー */}
        <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-white">配送画面</h1>
              <TruckSelector
                selectedTruck={selectedTruck}
                onSelect={handleTruckSelect}
              />
              {/* ナビゲーションタブ */}
              <div className="flex gap-1 ml-4">
                <Link
                  href="/loading"
                  className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-sm hover:bg-gray-600"
                >
                  積み込み
                </Link>
                <span className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm">
                  配送
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {selectedTruck && cargoArea && (
                <>
                  <span className="text-gray-400 text-sm">
                    積載領域: {((cargoArea.maxX - cargoArea.minX) / 1000).toFixed(1)}m x
                    {((cargoArea.maxY - cargoArea.minY) / 1000).toFixed(1)}m x
                    {((cargoArea.maxZ - cargoArea.minZ) / 1000).toFixed(1)}m
                  </span>

                  <button
                    onClick={handleLoadDemo}
                    disabled={isLoading}
                    className="px-3 py-1.5 bg-blue-500 text-white rounded text-sm disabled:opacity-50"
                  >
                    デモ
                  </button>

                  <button
                    onClick={handleReset}
                    className="px-3 py-1.5 bg-red-500 text-white rounded text-sm"
                  >
                    リセット
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 進捗表示 */}
          {placedItems.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-gray-400">
                配送進捗: {deliveredCount} / {totalLoadedCount}
              </span>
              <div className="flex-1 max-w-xs bg-gray-700 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: totalLoadedCount > 0 ? `${(deliveredCount / totalLoadedCount) * 100}%` : '0%' }}
                />
              </div>
            </div>
          )}
        </header>

        {/* 3Dビューアー: 配送待ちアイテム（まだトラックに残っているもの） */}
        <div className="flex-1 relative overflow-hidden">
          {objUrl && (
            <CargoViewer
              objUrl={objUrl}
              mtlUrl={mtlUrl}
              placedItems={pendingDeliveryItems}
              selectedItemId={selectedItemId}
              onItemSelect={setSelectedItemId}
              maxOrder={maxOrder}
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

        {/* スライダー */}
        {placedItems.length > 0 && (
          <div className="flex-shrink-0 p-4 bg-gray-800 border-t border-gray-700">
            <OrderSlider
              min={1}
              max={maxItemOrder}
              value={maxOrder}
              onChange={setMaxOrder}
            />
          </div>
        )}
      </div>

      {/* 右側: サイドバー */}
      {placedItems.length > 0 && (
        <ItemsSidebar
          items={pendingDeliveryItems}
          completedItems={deliveredItems}
          selectedItemId={selectedItemId}
          onItemSelect={setSelectedItemId}
          maxOrder={maxOrder}
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
