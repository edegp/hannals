'use client'

import { useState, useCallback } from 'react'
import { CargoViewer } from '@/components/CargoViewer'
import { TruckSelector } from '@/components/TruckSelector'
import { CsvImporter } from '@/components/CsvImporter'
import { PlacedItem, CargoArea, Item, Truck } from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

// デモ用の固定商品データ（仕様書: UIのみCSV、内部データは定数でハードコード）
const DEMO_ITEMS: Item[] = [
  { id: 'A001', x_mm: 600, y_mm: 400, z_mm: 300, order: 3, weight_kg: 12.5, fragile: false, rot_xy: true },
  { id: 'B010', x_mm: 205, y_mm: 195, z_mm: 180, order: 1, weight_kg: 5.2, fragile: true, rot_xy: false },
  { id: 'C003', x_mm: 400, y_mm: 300, z_mm: 250, order: 2, weight_kg: 8.0, fragile: false, rot_xy: true },
  { id: 'D005', x_mm: 350, y_mm: 280, z_mm: 200, order: 4, weight_kg: 6.5, fragile: false, rot_xy: true },
  { id: 'E007', x_mm: 500, y_mm: 350, z_mm: 280, order: 1, weight_kg: 10.0, fragile: false, rot_xy: true },
  { id: 'F012', x_mm: 300, y_mm: 250, z_mm: 200, order: 2, weight_kg: 7.5, fragile: true, rot_xy: false },
]

type GenerationStatus = 'idle' | 'generating' | 'completed'

export default function LoadingPlanPage() {
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null)
  const [cargoArea, setCargoArea] = useState<CargoArea | null>(null)
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([])
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [maxOrder, setMaxOrder] = useState(10)
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>('idle')
  const [showCsvImporter, setShowCsvImporter] = useState(false)
  const [items, setItems] = useState<Item[]>(DEMO_ITEMS)

  // 荷台のOBJ/MTL URLを生成
  const objUrl = selectedTruck ? `${API_URL}/api/trucks/${selectedTruck.id}/obj` : ''
  const mtlUrl = selectedTruck?.mtlFilePath ? `${API_URL}/api/trucks/${selectedTruck.id}/mtl` : ''

  // 荷台選択時の処理
  const handleTruckSelect = useCallback((truck: Truck) => {
    setSelectedTruck(truck)
    setPlacedItems([])
    setSelectedItemId(null)
    setGenerationStatus('idle')

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

  // 荷台のバウンディングボックスを受け取る（自動検出）
  const handleCargoAreaDetected = useCallback((area: CargoArea) => {
    setCargoArea(area)
  }, [])

  // CSVからインポートされた荷物を設定（UIのみ、内部データは固定）
  const handleItemsImported = useCallback((importedItems: Item[]) => {
    // 仕様書: CSVはUIのみ、内部データは定数でハードコード
    // ここでは表示上はインポートしたように見せるが、実際の計画生成では固定データを使用
    setShowCsvImporter(false)
    console.log('CSV imported (UI only):', importedItems.length, 'items')
  }, [])

  // 積み込み計画を生成
  const handleGeneratePlan = async () => {
    if (!selectedTruck) {
      alert('車両を選択してください')
      return
    }

    setGenerationStatus('generating')
    
    try {
      const response = await fetch(`${API_URL}/api/placements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          truckId: selectedTruck.id,
          items: items,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        setPlacedItems(result.placement.items)
        const maxItemOrder = Math.max(...result.placement.items.map((i: PlacedItem) => i.order), 1)
        setMaxOrder(maxItemOrder)
        setGenerationStatus('completed')
      } else {
        throw new Error('Failed to generate plan')
      }
    } catch (error) {
      console.error('Failed to generate loading plan:', error)
      alert('積み込み計画の生成に失敗しました')
      setGenerationStatus('idle')
    }
  }

  // リセット
  const handleReset = () => {
    setSelectedTruck(null)
    setCargoArea(null)
    setPlacedItems([])
    setGenerationStatus('idle')
  }

  // Stop数を計算
  const stopCount = items.length > 0 ? new Set(items.map(i => i.order)).size : 0

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* ヘッダー */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">積み込み計画生成</h1>
            <p className="text-sm text-gray-400 mt-1">倉庫スタッフ向け</p>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => window.location.href = '/warehouse/loading-work'}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500"
            >
              積み込み作業支援へ
            </button>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左サイドバー: 入力・設定エリア */}
        <div className="w-96 bg-gray-800 border-r border-gray-700 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* 商品情報 */}
            <section className="bg-gray-750 rounded-lg p-4 border border-gray-700">
              <h2 className="text-lg font-semibold text-white mb-4">商品情報</h2>
              
              <button
                onClick={() => setShowCsvImporter(true)}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 font-medium"
              >
                📄 商品CSVをアップロード
              </button>
              
              <div className="mt-4 text-sm text-gray-300">
                <div className="flex justify-between py-2 border-b border-gray-600">
                  <span>商品件数:</span>
                  <span className="font-semibold">{items.length}件</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-600">
                  <span>Stop数:</span>
                  <span className="font-semibold">{stopCount}箇所</span>
                </div>
                <div className="flex justify-between py-2">
                  <span>総重量:</span>
                  <span className="font-semibold">
                    {items.reduce((sum, item) => sum + (item.weight_kg || 0), 0).toFixed(1)}kg
                  </span>
                </div>
              </div>
            </section>

            {/* 車両選択 */}
            <section className="bg-gray-750 rounded-lg p-4 border border-gray-700">
              <h2 className="text-lg font-semibold text-white mb-4">車両選択</h2>
              
              <TruckSelector
                selectedTruck={selectedTruck}
                onSelect={handleTruckSelect}
                onAddNew={() => {}}
              />
              
              {selectedTruck && cargoArea && (
                <div className="mt-4 text-sm text-gray-300">
                  <div className="flex justify-between py-2 border-b border-gray-600">
                    <span>車両名:</span>
                    <span className="font-semibold">{selectedTruck.name}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-600">
                    <span>荷台寸法:</span>
                    <span className="font-semibold">
                      {((cargoArea.maxX - cargoArea.minX) / 1000).toFixed(1)}m x
                      {((cargoArea.maxY - cargoArea.minY) / 1000).toFixed(1)}m x
                      {((cargoArea.maxZ - cargoArea.minZ) / 1000).toFixed(1)}m
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span>出入口:</span>
                    <span className="font-semibold">
                      {selectedTruck.entranceDirection || '未設定'}
                    </span>
                  </div>
                </div>
              )}
            </section>

            {/* 生成ステータス */}
            <section className="bg-gray-750 rounded-lg p-4 border border-gray-700">
              <h2 className="text-lg font-semibold text-white mb-4">生成ステータス</h2>
              
              <div className="text-center">
                {generationStatus === 'idle' && (
                  <div className="text-gray-400">未生成</div>
                )}
                {generationStatus === 'generating' && (
                  <div className="text-yellow-400">
                    <div className="animate-spin h-8 w-8 border-4 border-yellow-400 border-t-transparent rounded-full mx-auto mb-2"></div>
                    生成中...
                  </div>
                )}
                {generationStatus === 'completed' && (
                  <div className="text-green-400">✓ 生成完了</div>
                )}
              </div>

              <button
                onClick={handleGeneratePlan}
                disabled={!selectedTruck || generationStatus === 'generating'}
                className="w-full mt-4 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed font-semibold"
              >
                {generationStatus === 'generating' ? '生成中...' : '積み込み計画を生成する'}
              </button>

              {generationStatus === 'completed' && (
                <button
                  onClick={handleReset}
                  className="w-full mt-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-500 font-semibold"
                >
                  リセット
                </button>
              )}
            </section>
          </div>
        </div>

        {/* 右側: 3Dプレビューエリア */}
        <div className="flex-1 relative">
          {generationStatus === 'completed' && selectedTruck ? (
            <>
              <div className="absolute top-4 left-4 z-10 bg-gray-800 bg-opacity-90 px-4 py-2 rounded-lg border border-gray-600">
                <h3 className="text-white font-semibold">積み込み済み3D表示</h3>
                <p className="text-sm text-gray-300">配置された荷物: {placedItems.length}個</p>
              </div>
              
              <CargoViewer
                objUrl={objUrl}
                mtlUrl={mtlUrl}
                placedItems={placedItems}
                selectedItemId={selectedItemId}
                onItemSelect={setSelectedItemId}
                cargoArea={cargoArea}
                entranceDirection={selectedTruck.entranceDirection as any}
                isSelectingEntrance={false}
                onEntranceClick={() => {}}
                onCargoAreaDetected={handleCargoAreaDetected}
                className="w-full h-full"
              />
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-400">
                <div className="text-6xl mb-4">📦</div>
                <div className="text-xl">
                  {!selectedTruck
                    ? '車両を選択して、積み込み計画を生成してください'
                    : '「積み込み計画を生成する」ボタンをクリックしてください'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

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


