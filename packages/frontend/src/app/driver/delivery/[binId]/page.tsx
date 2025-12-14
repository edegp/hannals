'use client'

import { useState, useCallback, useEffect, useRef, use } from 'react'
import { CargoViewer } from '@/components/CargoViewer'
import { PlacedItem, CargoArea } from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

// Stop情報の型定義
interface Stop {
  stopNumber: number
  address: string
  recipientName: string
  itemCount: number
  status: 'pending' | 'completed'
}

export default function DeliveryPage({ params }: { params: Promise<{ binId: string }> }) {
  const { binId } = use(params)
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([])
  const [cargoArea, setCargoArea] = useState<CargoArea | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [selectedStop, setSelectedStop] = useState<number>(1)
  const [stops, setStops] = useState<Stop[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [maxOrder, setMaxOrder] = useState(10)
  const stopRefs = useRef<Record<number, HTMLButtonElement | null>>({})
  const isInitialLoadRef = useRef(true)

  // デモデータの読み込み
  useEffect(() => {
    loadDeliveryPlan()
  }, [])

  const loadDeliveryPlan = async () => {
    setIsLoading(true)
    try {
      // デモ用の最適配置を読み込む
      const response = await fetch(`${API_URL}/api/demo/optimal/items`)
      if (response.ok) {
        const result: { items: PlacedItem[] } = await response.json()
        const items = result.items ?? []

        setPlacedItems(items)

        const maxItemOrder = Math.max(...items.map((i: PlacedItem) => i.order), 1)
        setMaxOrder(maxItemOrder)

        // Stopリストを生成
        const uniqueStops: number[] = Array.from(new Set<number>(items.map((i: PlacedItem) => i.order)))
          .sort((a, b) => a - b)

        const stopList: Stop[] = uniqueStops.map(stopNum => ({
          stopNumber: stopNum,
          address: `配送先${stopNum} (東京都渋谷区${stopNum}-${stopNum}-${stopNum})`,
          recipientName: `受取人${stopNum}`,
          itemCount: items.filter((i: PlacedItem) => i.order === stopNum).length,
          status: 'pending' as const,
        }))

        setStops(stopList)
        // orderの最小値（最初の配送先）を初期値として設定
        setSelectedStop(uniqueStops.length > 0 ? uniqueStops[0] : 1)
      }
    } catch (error) {
      console.error('Failed to load delivery plan:', error)
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

  // Stop完了処理
  const handleCompleteStop = () => {
    // 現在のStopを完了に更新
    const updatedStops = stops.map(stop =>
      stop.stopNumber === selectedStop
        ? { ...stop, status: 'completed' as const }
        : stop
    )
    setStops(updatedStops)

    // order順で次のStopを見つける
    const currentIndex = stops.findIndex(s => s.stopNumber === selectedStop)
    if (currentIndex >= 0 && currentIndex < stops.length - 1) {
      // 次のStopへ移動（order順）
      const nextStop = stops[currentIndex + 1].stopNumber
      setSelectedStop(nextStop)
      setSelectedItemId(null)
    }
    // 最後のStopの場合は何もしない（完了のみ）
  }

  // Stop選択処理
  const handleSelectStop = (stopNumber: number) => {
    setSelectedStop(stopNumber)
    setSelectedItemId(null)
  }

  // 現在のStopの情報を取得
  const currentStop = stops.find(s => s.stopNumber === selectedStop)

  // 現在のStopの荷物のみ表示するためのフィルタ
  const currentStopItems = placedItems.filter(item => item.order === selectedStop)

  // 完了したStop数
  const completedStopsCount = stops.filter(s => s.status === 'completed').length
  const progressPercentage = stops.length > 0 ? (completedStopsCount / stops.length) * 100 : 0

  // すべて完了したか
  const isAllCompleted = completedStopsCount === stops.length

  // Stop完了時に最初の未完了Stopへスクロール
  useEffect(() => {
    // 初回ロード時はスクロールしない
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false
      return
    }

    // 最初の未完了のStopを見つける
    const firstPendingStop = stops.find(stop => stop.status === 'pending')
    
    if (firstPendingStop) {
      const stopElement = stopRefs.current[firstPendingStop.stopNumber]
      
      if (stopElement) {
        // 状態更新後にスクロール
        const timer = setTimeout(() => {
          stopElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start', // 画面の上部に表示
          })
        }, 150)

        return () => clearTimeout(timer)
      }
    }
  }, [completedStopsCount]) // 完了数が変わったときに実行

  // 選択されたStopにスクロール（手動選択時）
  useEffect(() => {
    const stopElement = stopRefs.current[selectedStop]
    
    if (stopElement) {
      // 少し遅延を入れて、状態更新後にスクロール
      const timer = setTimeout(() => {
        stopElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        })
      }, 100)

      return () => clearTimeout(timer)
    }
  }, [selectedStop])

  // 次のStop情報を計算
  const currentIndex = stops.findIndex(s => s.stopNumber === selectedStop)
  const hasNextStop = currentIndex >= 0 && currentIndex < stops.length - 1
  const nextStopNumber = hasNextStop ? stops[currentIndex + 1].stopNumber : null

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* ヘッダー */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">配送・取り出し支援（3D）</h1>
            <p className="text-sm text-gray-400 mt-1">
              ドライバー向け - 便ID: {binId}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-300">
              進捗: <span className="font-semibold text-green-400">{completedStopsCount}</span> / {stops.length} Stop
              <span className="ml-2">({progressPercentage.toFixed(0)}%)</span>
            </div>

            <button
              onClick={() => window.location.href = '/driver/departures'}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500"
            >
              便一覧へ戻る
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
        {/* 左サイドバー: Stop一覧 */}
        <div className="w-80 bg-gray-800 border-r border-gray-700 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-lg font-semibold text-white mb-4">配送先一覧</h2>

            <div className="space-y-2">
              {stops.map((stop) => (
                <button
                  key={stop.stopNumber}
                  ref={(el) => {
                    if (el) {
                      stopRefs.current[stop.stopNumber] = el
                    } else {
                      delete stopRefs.current[stop.stopNumber]
                    }
                  }}
                  onClick={() => handleSelectStop(stop.stopNumber)}
                  disabled={stop.status === 'completed'}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${selectedStop === stop.stopNumber
                      ? 'bg-blue-900 border-blue-500'
                      : stop.status === 'completed'
                        ? 'bg-gray-700 border-gray-600 opacity-50'
                        : 'bg-gray-750 border-gray-600 hover:border-gray-500'
                    }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white">Stop {stop.stopNumber}</span>
                    {stop.status === 'completed' && (
                      <span className="text-green-400 text-sm">✓ 完了</span>
                    )}
                  </div>

                  <div className="text-sm text-gray-300 space-y-1">
                    <div className="truncate">{stop.address}</div>
                    <div className="text-gray-400">{stop.recipientName}</div>
                    <div className="text-gray-400">荷物: {stop.itemCount}個</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 中央: 3Dビューアー */}
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
              {/* 現在のStop情報 */}
              {currentStop && (
                <div className="absolute top-4 left-4 z-10 bg-gray-800 bg-opacity-95 px-6 py-4 rounded-lg border border-gray-600 shadow-lg">
                  <h3 className="text-white font-bold text-lg mb-2">
                    {currentStop.status === 'completed' ? '✓ 配送完了' : '現在の配送先'}
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex gap-4">
                      <span className="text-gray-400">Stop:</span>
                      <span className="font-semibold text-white">{currentStop.stopNumber}</span>
                    </div>
                    <div className="flex gap-4">
                      <span className="text-gray-400">住所:</span>
                      <span className="font-semibold text-white">{currentStop.address}</span>
                    </div>
                    <div className="flex gap-4">
                      <span className="text-gray-400">受取人:</span>
                      <span className="font-semibold text-white">{currentStop.recipientName}</span>
                    </div>
                    <div className="flex gap-4">
                      <span className="text-gray-400">荷物数:</span>
                      <span className="font-semibold text-blue-400">{currentStop.itemCount}個</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 荷物リスト（右上） */}
              {currentStopItems.length > 0 && (
                <div className="absolute top-4 right-4 z-10 bg-gray-800 bg-opacity-95 px-6 py-4 rounded-lg border border-gray-600 shadow-lg max-h-96 overflow-y-auto">
                  <h3 className="text-white font-bold text-sm mb-3">取り出す荷物</h3>
                  <div className="space-y-2">
                    {currentStopItems.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3 rounded border cursor-pointer ${selectedItemId === item.id
                            ? 'bg-blue-900 border-blue-500'
                            : 'bg-gray-700 border-gray-600 hover:border-gray-500'
                          }`}
                        onClick={() => setSelectedItemId(item.id)}
                      >
                        <div className="font-mono text-white text-sm">{item.id}</div>
                        <div className="text-xs text-gray-400 mt-1">
                          {item.x_mm}×{item.y_mm}×{item.z_mm}mm
                        </div>
                        {item.fragile && (
                          <div className="text-xs text-red-400 mt-1">⚠️ 割れ物</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <CargoViewer
                objUrl={objUrl}
                mtlUrl={mtlUrl}
                placedItems={placedItems}
                selectedItemId={selectedItemId}
                onItemSelect={setSelectedItemId}
                cargoArea={cargoArea}
                entranceDirection={null}
                isSelectingEntrance={false}
                onEntranceClick={() => { }}
                onCargoAreaDetected={handleCargoAreaDetected}
                className="w-full h-full"
              />
            </>
          )}
        </div>
      </div>

      {/* コントロールパネル */}
      {!isLoading && (
        <div className="p-6 bg-gray-800 border-t border-gray-700">
          <div className="max-w-4xl mx-auto">
            {!isAllCompleted ? (
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={handleCompleteStop}
                  disabled={currentStop?.status === 'completed'}
                  className="px-8 py-4 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed font-bold text-lg"
                >
                  {currentStop?.status === 'completed'
                    ? '✓ 配送完了済み'
                    : `Stop ${selectedStop} 完了`}
                </button>

                {hasNextStop && currentStop?.status !== 'completed' && (
                  <span className="text-gray-400 text-sm">
                    次へ進むと Stop {nextStopNumber} に移動します
                  </span>
                )}
              </div>
            ) : (
              <div className="text-center">
                <div className="text-green-400 font-bold text-2xl mb-4">
                  🎉 すべての配送が完了しました！
                </div>
                <p className="text-gray-300 mb-4">お疲れ様でした。配送報告を行ってください。</p>
                <button
                  onClick={() => window.location.href = '/driver/departures'}
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 font-semibold"
                >
                  便一覧へ戻る
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


