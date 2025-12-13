'use client'

import { useState, useCallback, useEffect } from 'react'
import { CargoViewer } from '@/components/CargoViewer'
import { ItemsSidebar } from '@/components/ItemsSidebar'
import { OrderSlider } from '@/components/OrderSlider'
import { PlacedItem, CargoArea, Truck } from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

export default function LoadingWorkPage() {
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null)
  const [cargoArea, setCargoArea] = useState<CargoArea | null>(null)
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([])
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [maxOrder, setMaxOrder] = useState(10)
  const [currentLoadOrder, setCurrentLoadOrder] = useState(1)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

  // デモデータの読み込み（実際には計画生成画面で作成されたデータを読み込む想定）
  useEffect(() => {
    loadDemoPlan()
  }, [])

  const loadDemoPlan = async () => {
    setIsLoading(true)
    try {
      // デモ用の最適配置を読み込む
      const response = await fetch(`${API_URL}/api/demo/optimal/items`)
      if (response.ok) {
        const result = await response.json()
        setPlacedItems(result.items)
        
        const maxItemOrder = Math.max(...result.items.map((i: PlacedItem) => i.loadOrder ?? i.order), 1)
        setMaxOrder(maxItemOrder)
        setCurrentLoadOrder(1)
        
        // 最初の荷物を自動選択
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

  // 荷台のOBJ/MTL URLを生成（デモ用の固定パス）
  const objUrl = '/trunkVoxel_cleaned.obj'
  const mtlUrl = '/trunkVoxel_2512131543.mtl'

  // 荷台のバウンディングボックスを受け取る（自動検出）
  const handleCargoAreaDetected = useCallback((area: CargoArea) => {
    setCargoArea(area)
  }, [])

  // 次の荷物へ進む
  const handleNextItem = () => {
    if (currentLoadOrder < maxOrder) {
      const nextOrder = currentLoadOrder + 1
      setCurrentLoadOrder(nextOrder)
      
      // 次の積み込み順の荷物を選択
      const nextItem = placedItems.find(i => (i.loadOrder ?? i.order) === nextOrder)
      if (nextItem) {
        setSelectedItemId(nextItem.id)
      }
    }
  }

  // 前の荷物へ戻る
  const handlePrevItem = () => {
    if (currentLoadOrder > 1) {
      const prevOrder = currentLoadOrder - 1
      setCurrentLoadOrder(prevOrder)
      
      // 前の積み込み順の荷物を選択
      const prevItem = placedItems.find(i => (i.loadOrder ?? i.order) === prevOrder)
      if (prevItem) {
        setSelectedItemId(prevItem.id)
      }
    }
  }

  // 現在の積み込み順の荷物を取得
  const currentItem = placedItems.find(i => (i.loadOrder ?? i.order) === currentLoadOrder)
  
  // 進捗率を計算
  const progressPercentage = maxOrder > 0 ? (currentLoadOrder / maxOrder) * 100 : 0

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* ヘッダー */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">積み込み作業支援（3D）</h1>
            <p className="text-sm text-gray-400 mt-1">倉庫スタッフ向け - 荷物リスト＋3D配置指示</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-300">
              進捗: <span className="font-semibold text-green-400">{currentLoadOrder}</span> / {maxOrder}
              <span className="ml-2">({progressPercentage.toFixed(0)}%)</span>
            </div>
            
            <button
              onClick={() => window.location.href = '/warehouse/loading-plan'}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500"
            >
              計画生成画面へ
            </button>
          </div>
        </div>

        {/* 進捗バー */}
        <div className="mt-3 w-full bg-gray-700 rounded-full h-2">
          <div 
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <div className="flex-1 flex overflow-hidden">
        {/* 3Dビューアー */}
        <div className="flex-1 relative">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-400">
                <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <div className="text-xl">読み込み中...</div>
              </div>
            </div>
          ) : (
            <>
              {/* 現在の荷物情報 */}
              {currentItem && (
                <div className="absolute top-4 left-4 z-10 bg-gray-800 bg-opacity-95 px-6 py-4 rounded-lg border border-gray-600 shadow-lg">
                  <h3 className="text-white font-bold text-lg mb-2">次に積み込む荷物</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex gap-4">
                      <span className="text-gray-400">荷物ID:</span>
                      <span className="font-semibold text-white">{currentItem.id}</span>
                    </div>
                    <div className="flex gap-4">
                      <span className="text-gray-400">サイズ:</span>
                      <span className="font-semibold text-white">
                        {currentItem.x_mm}×{currentItem.y_mm}×{currentItem.z_mm}mm
                      </span>
                    </div>
                    <div className="flex gap-4">
                      <span className="text-gray-400">配送順:</span>
                      <span className="font-semibold text-blue-400">Stop {currentItem.order}</span>
                    </div>
                    {currentItem.fragile && (
                      <div className="flex gap-4">
                        <span className="text-red-400">⚠️ 割れ物注意</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <CargoViewer
                objUrl={objUrl}
                mtlUrl={mtlUrl}
                placedItems={placedItems}
                selectedItemId={selectedItemId}
                onItemSelect={setSelectedItemId}
                maxOrder={currentLoadOrder} // 現在までの積み込み順まで表示
                cargoArea={cargoArea}
                entrancePoint={null}
                entranceDirection={null}
                isSelectingEntrance={false}
                onEntranceClick={() => {}}
                onCargoAreaDetected={handleCargoAreaDetected}
                className="w-full h-full"
              />
            </>
          )}
        </div>

        {/* サイドバー: 荷物リスト */}
        {placedItems.length > 0 && (
          <ItemsSidebar
            items={placedItems}
            selectedItemId={selectedItemId}
            onItemSelect={setSelectedItemId}
            maxOrder={currentLoadOrder} // 現在までの積み込み順まで表示
            isOpen={sidebarOpen}
            onToggle={() => setSidebarOpen(!sidebarOpen)}
          />
        )}
      </div>

      {/* コントロールパネル */}
      {placedItems.length > 0 && (
        <div className="p-6 bg-gray-800 border-t border-gray-700">
          <div className="max-w-4xl mx-auto space-y-4">
            {/* ナビゲーションボタン */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handlePrevItem}
                disabled={currentLoadOrder <= 1}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed font-semibold"
              >
                ← 前の荷物
              </button>
              
              <div className="px-8 py-3 bg-gray-700 text-white rounded-lg font-bold text-lg">
                {currentLoadOrder} / {maxOrder}
              </div>
              
              <button
                onClick={handleNextItem}
                disabled={currentLoadOrder >= maxOrder}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed font-semibold"
              >
                次の荷物 →
              </button>
            </div>

            {/* スライダー */}
            <div>
              <OrderSlider
                min={1}
                max={maxOrder}
                value={currentLoadOrder}
                onChange={(value) => {
                  setCurrentLoadOrder(value)
                  const item = placedItems.find(i => (i.loadOrder ?? i.order) === value)
                  if (item) {
                    setSelectedItemId(item.id)
                  }
                }}
              />
            </div>

            {currentLoadOrder >= maxOrder && (
              <div className="text-center">
                <div className="text-green-400 font-bold text-xl mb-2">
                  ✓ すべての荷物の積み込みが完了しました！
                </div>
                <button
                  onClick={() => window.location.href = '/driver/departures'}
                  className="px-8 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-500 font-semibold"
                >
                  配送画面へ
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


