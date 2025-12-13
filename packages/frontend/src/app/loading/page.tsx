'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { CargoViewer } from '@/components/CargoViewer'
import { OrderSlider } from '@/components/OrderSlider'
import { ItemsSidebar } from '@/components/ItemsSidebar'
import { TruckSelector } from '@/components/TruckSelector'
import { CsvImporter } from '@/components/CsvImporter'
import { PlacedItem, CargoArea, ClickPoint, Item, Truck } from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

// 入り口方向
type EntranceDirection = 'front' | 'back' | 'left' | 'right' | null

export default function LoadingPage() {
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null)
  const [cargoArea, setCargoArea] = useState<CargoArea | null>(null)
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([])
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [maxOrder, setMaxOrder] = useState(10)
  const [entranceDirection, setEntranceDirection] = useState<EntranceDirection>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showCsvImporter, setShowCsvImporter] = useState(false)
  const [inputItems, setInputItems] = useState<Item[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // 荷台のOBJ/MTL URLを生成
  const objUrl = selectedTruck ? `${API_URL}/api/trucks/${selectedTruck.id}/obj` : null
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
        const maxItemOrder = Math.max(...result.placement.items.map((i: PlacedItem) => i.loadOrder ?? i.order), 1)
        setMaxOrder(maxItemOrder)
      }
    } catch (error) {
      console.error('Failed to place items:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // デモ配置を読み込む（データベースに保存）
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
        const maxItemOrder = Math.max(...result.items.map((i: PlacedItem) => i.loadOrder ?? i.order), 1)
        setMaxOrder(maxItemOrder)
      }
    } catch (error) {
      console.error('Failed to load demo:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 積み込み済みにする
  const handleMarkLoaded = async (itemId: string) => {
    // ローカル状態を更新（isLoaded=trueで3Dビューに表示、サイドバーから除外）
    setPlacedItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, isLoaded: true, loadedAt: new Date().toISOString() } : item
    ))

    // APIにも送信
    try {
      await fetch(`${API_URL}/api/items/${itemId}/load`, {
        method: 'PATCH',
      })
    } catch (error) {
      // エラーは無視（ローカル状態は更新済み）
    }
  }

  // 積み込み取消
  const handleUnload = async (itemId: string) => {
    // ローカル状態を更新
    setPlacedItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, isLoaded: false, loadedAt: undefined } : item
    ))

    // APIにも送信
    try {
      await fetch(`${API_URL}/api/items/${itemId}/unload`, {
        method: 'PATCH',
      })
    } catch (error) {
      // エラーは無視
    }
  }

  // リセット
  const handleReset = () => {
    setPlacedItems([])
    setInputItems([])
  }

  // 3Dビュー用: 積み込み済みアイテム（トラックに積まれた状態）
  const loadedItems = placedItems.filter(item => item.isLoaded)

  // サイドバー用: まだ積み込んでいないアイテム
  // 積み込み順: Y大きい（奥）→ X小さい（Xを先に埋める）
  const pendingItems = placedItems
    .filter(item => !item.isLoaded)
    .sort((a, b) => {
      // まずYで比較（大きい順 = 奥から）
      if (a.posY !== b.posY) return b.posY - a.posY
      // Yが同じならXで比較（小さい順）
      return a.posX - b.posX
    })

  const maxItemOrder = placedItems.length > 0
    ? Math.max(...placedItems.map(i => i.loadOrder ?? i.order))
    : 1

  const loadedCount = placedItems.filter(item => item.isLoaded).length

  return (
    <div className="h-screen flex bg-gray-900 overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* ヘッダー */}
        <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-white">積み込み画面</h1>
              <TruckSelector
                selectedTruck={selectedTruck}
                onSelect={handleTruckSelect}
              />
              {/* ナビゲーションタブ */}
              <div className="flex gap-1 ml-4">
                <span className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm">
                  積み込み
                </span>
                <Link
                  href="/delivery"
                  className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-sm hover:bg-gray-600"
                >
                  配送
                </Link>
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
                    onClick={() => setShowCsvImporter(true)}
                    className="px-3 py-1.5 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-500"
                  >
                    CSV ({inputItems.length})
                  </button>

                  <button
                    onClick={handlePlaceItems}
                    disabled={isLoading || inputItems.length === 0}
                    className="px-3 py-1.5 bg-green-500 text-white rounded text-sm disabled:opacity-50"
                  >
                    配置
                  </button>

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
                積み込み進捗: {loadedCount} / {placedItems.length}
              </span>
              <div className="flex-1 max-w-xs bg-gray-700 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${(loadedCount / placedItems.length) * 100}%` }}
                />
              </div>
            </div>
          )}
        </header>

        {/* 3Dビューアー: 積み込み済みアイテムを表示 */}
        <div className="flex-1 relative overflow-hidden">
          {objUrl && (
            <CargoViewer
              objUrl={objUrl}
              mtlUrl={mtlUrl}
              placedItems={loadedItems}
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
          items={pendingItems}
          completedItems={loadedItems}
          selectedItemId={selectedItemId}
          onItemSelect={setSelectedItemId}
          maxOrder={maxOrder}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          mode="loading"
          onStatusChange={handleMarkLoaded}
          onStatusUndo={handleUnload}
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
