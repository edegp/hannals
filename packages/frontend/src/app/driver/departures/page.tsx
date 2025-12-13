'use client'

import { useState, useEffect } from 'react'
import { Truck } from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

// 配送時間のmockデータ（トラックIDをキーにした出発予定時刻）
const MOCK_DEPARTURE_TIMES: Record<string, string> = {
  // 特定のトラックIDに対する出発時刻をここに追加可能
  // 'truck-id-1': '08:00',
  // 'truck-id-2': '09:30',
}

// デフォルトの出発時刻リスト（トラックIDが存在しない場合に使用）
const DEFAULT_DEPARTURE_TIMES = ['08:00', '09:30', '13:00', '14:30', '16:00']

// トラックIDから出発予定時刻を取得（mock）
const getDepartureTime = (truckId: string, index: number): string => {
  if (MOCK_DEPARTURE_TIMES[truckId]) {
    return MOCK_DEPARTURE_TIMES[truckId]
  }
  // トラックIDが存在しない場合は、インデックスに基づいてデフォルト時刻を返す
  return DEFAULT_DEPARTURE_TIMES[index % DEFAULT_DEPARTURE_TIMES.length]
}

export default function DeparturesPage() {
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchTrucks = async () => {
      try {
        const response = await fetch(`${API_URL}/api/trucks`)
        if (response.ok) {
          const data = await response.json()
          setTrucks(data)
        }
      } catch (error) {
        console.error('Failed to fetch trucks:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchTrucks()
  }, [])

  // 配送画面へ遷移（簡易実装）
  const handleStartDelivery = (truckId: string) => {
    // 簡易的にトラックIDを使用
    window.location.href = `/driver/delivery/${truckId}`
  }

  // 現在時刻を取得
  const currentTime = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  const currentDate = new Date().toLocaleDateString('ja-JP', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    weekday: 'long' 
  })

  return (
    <div className="min-h-screen bg-gray-900">
      {/* ヘッダー */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">出発便一覧（本日の担当）</h1>
              <p className="text-sm text-gray-400 mt-1">ドライバー向け</p>
            </div>
            
            <div className="text-right">
              <div className="text-white font-semibold">{currentDate}</div>
              <div className="text-gray-400 text-sm mt-1">現在時刻: {currentTime}</div>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* 注意事項 */}
        <div className="bg-blue-900 border border-blue-700 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="text-blue-400 text-xl">ℹ️</div>
            <div className="text-blue-200 text-sm">
              <p className="font-semibold mb-1">配送開始前の確認事項</p>
              <ul className="list-disc list-inside space-y-1">
                <li>積み込み完了の便のみ出発できます</li>
                <li>出発前に車両の安全確認を行ってください</li>
                <li>配送中は各Stop単位で荷物の位置を確認できます</li>
              </ul>
            </div>
          </div>
        </div>

        {/* トラック一覧 */}
        {isLoading ? (
          <div className="text-center py-16">
            <div className="animate-spin h-8 w-8 border-4 border-blue-400 border-t-transparent rounded-full mx-auto mb-4"></div>
            <div className="text-xl text-gray-400">読み込み中...</div>
          </div>
        ) : (
          <div className="space-y-4">
            {trucks.map((truck, index) => {
              const departureTime = getDepartureTime(truck.id, index)

              return (
                <div
                  key={truck.id}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-3">
                        <h2 className="text-xl font-bold text-white">{truck.name}</h2>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-gray-400 mb-1">トラックID</div>
                          <div className="text-white font-mono">{truck.id}</div>
                        </div>
                        <div>
                          <div className="text-gray-400 mb-1">出発予定時刻</div>
                          <div className="text-white font-semibold">{departureTime}</div>
                        </div>
                      </div>
                    </div>

                    <div className="ml-6">
                      <button
                        onClick={() => handleStartDelivery(truck.id)}
                        className="px-8 py-4 bg-green-600 text-white rounded-lg hover:bg-green-500 font-bold text-lg shadow-lg"
                      >
                        配送画面を開く →
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* トラックが0件の場合 */}
        {!isLoading && trucks.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📦</div>
            <div className="text-xl text-gray-400">登録されたトラックがありません</div>
          </div>
        )}

        {/* フッター情報 */}
        <div className="mt-8 p-4 bg-gray-800 rounded-lg border border-gray-700">
          <div className="text-sm text-gray-400">
            <p className="font-semibold mb-2">お知らせ</p>
            <ul className="list-disc list-inside space-y-1">
              <li>配送完了後は必ず報告を行ってください</li>
              <li>荷物の破損や配送先不在の場合は速やかに連絡してください</li>
              <li>安全運転を心がけてください</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}


