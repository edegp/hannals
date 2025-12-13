'use client'

import { useState, useEffect } from 'react'
import { Placement, PlacedItem } from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

// 便のステータス
type DepartureStatus = 'loading' | 'loaded' | 'departed' | 'completed'

// 便の型定義
interface Departure {
  binId: string
  vehicleName: string
  departureTime: string
  estimatedStops: number
  status: DepartureStatus
  itemCount: number
  driverName: string
}

export default function DeparturesPage() {
  const [departures, setDepartures] = useState<Departure[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ステータスの表示名と色を取得
  const getStatusInfo = (status: DepartureStatus) => {
    switch (status) {
      case 'loading':
        return { label: '積み込み中', color: 'bg-yellow-500', textColor: 'text-yellow-500' }
      case 'loaded':
        return { label: '積み込み完了', color: 'bg-green-500', textColor: 'text-green-500' }
      case 'departed':
        return { label: '出発済み', color: 'bg-blue-500', textColor: 'text-blue-500' }
      case 'completed':
        return { label: '配送完了', color: 'bg-gray-500', textColor: 'text-gray-500' }
    }
  }

  // バックエンドから出発便データを取得
  useEffect(() => {
    const fetchDepartures = async () => {
      setIsLoading(true)
      setError(null)
      try {
        // 配置一覧を取得
        const placementsResponse = await fetch(`${API_URL}/api/placements`)
        
        if (!placementsResponse.ok) {
          throw new Error('配置一覧の取得に失敗しました')
        }
        const placements: Placement[] = await placementsResponse.json()

        // 各配置の詳細を取得（itemsのステータスを含む）
        const departurePromises = placements.map(async (placement) => {
          const detailResponse = await fetch(`${API_URL}/api/placements/${placement.id}`)
          
          if (!detailResponse.ok) {
            return null
          }
          const detail: Placement = await detailResponse.json()
          
          // itemsが存在しない場合は空配列として扱う
          if (!detail.items) {
            detail.items = []
          }
          
          return detail
        })

        const placementDetails = (await Promise.all(departurePromises)).filter(
          (p): p is Placement & { items: PlacedItem[] } => {
            if (p === null) return false
            // itemsが空でも含める（荷物0個の便として扱う）
            if (!p.items) {
              p.items = []
            }
            return true
          }
        )

        // ステータスを判定してDeparture型に変換
        const departureList: Departure[] = placementDetails.map((placement) => {
          const items = placement.items || []
          const itemCount = items.length

          // 配送先数（orderのユニークな値の数）
          const uniqueOrders = new Set(items.map((item) => item.order))
          const estimatedStops = uniqueOrders.size

          // ステータス判定
          // - 全ての荷物が積み込み済み → 'loaded'
          // - 一部でも積み込み済み → 'loading'
          // - 全て配送済み → 'completed'
          // - それ以外 → 'loading'
          const allLoaded = items.length > 0 && items.every((item) => item.isLoaded === true)
          const allDelivered = items.length > 0 && items.every((item) => item.isDelivered === true)
          const someLoaded = items.some((item) => item.isLoaded === true)

          let status: DepartureStatus
          if (allDelivered) {
            status = 'completed'
          } else if (allLoaded) {
            status = 'loaded'
          } else if (someLoaded) {
            status = 'loading'
          } else {
            status = 'loading'
          }

          // 出発予定時刻（createdAtから計算、またはデフォルト値）
          const createdAt = new Date(placement.createdAt)
          const departureTime = createdAt.toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
          })

          return {
            binId: placement.id,
            vehicleName: placement.truck?.name || '未設定の車両',
            departureTime,
            estimatedStops,
            status,
            itemCount,
            driverName: '山田太郎', // TODO: 実際のドライバー情報を取得
          }
        })

        // 出発予定時刻でソート
        departureList.sort((a, b) => {
          const timeA = a.departureTime.replace(':', '')
          const timeB = b.departureTime.replace(':', '')
          return timeA.localeCompare(timeB)
        })

        setDepartures(departureList)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'データの取得に失敗しました')
      } finally {
        setIsLoading(false)
      }
    }

    fetchDepartures()
  }, [])

  // 出発可能かどうか
  const canDepart = (status: DepartureStatus) => {
    return status === 'loaded'
  }

  // 配送画面へ遷移
  const handleStartDelivery = (binId: string) => {
    window.location.href = `/driver/delivery/${binId}`
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
        {/* ローディング表示 */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <div className="text-xl text-gray-400">データを読み込み中...</div>
            </div>
          </div>
        )}

        {/* エラー表示 */}
        {error && !isLoading && (
          <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="text-red-400 text-xl">⚠️</div>
              <div className="text-red-200">
                <p className="font-semibold mb-1">エラーが発生しました</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* 注意事項 */}
        {!isLoading && !error && (
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
        )}

        {/* 便一覧 */}
        {!isLoading && !error && (
          <div className="space-y-4">
          {departures.map((departure) => {
            const statusInfo = getStatusInfo(departure.status)
            const isDepartable = canDepart(departure.status)

            return (
              <div
                key={departure.binId}
                className={`bg-gray-800 border rounded-lg p-6 ${
                  isDepartable ? 'border-green-500' : 'border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-3">
                      <h2 className="text-xl font-bold text-white">{departure.vehicleName}</h2>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusInfo.color} text-white`}>
                        {statusInfo.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-gray-400 mb-1">便ID</div>
                        <div className="text-white font-mono">{departure.binId}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 mb-1">出発予定時刻</div>
                        <div className="text-white font-semibold">{departure.departureTime}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 mb-1">配送先</div>
                        <div className="text-white">{departure.estimatedStops}箇所</div>
                      </div>
                      <div>
                        <div className="text-gray-400 mb-1">荷物数</div>
                        <div className="text-white">{departure.itemCount}個</div>
                      </div>
                    </div>
                  </div>

                  <div className="ml-6">
                    {isDepartable ? (
                      <button
                        onClick={() => handleStartDelivery(departure.binId)}
                        className="px-8 py-4 bg-green-600 text-white rounded-lg hover:bg-green-500 font-bold text-lg shadow-lg"
                      >
                        配送画面を開く →
                      </button>
                    ) : (
                      <div className="px-8 py-4 bg-gray-700 text-gray-400 rounded-lg cursor-not-allowed text-center">
                        <div className="text-sm">🔒</div>
                        <div className="text-xs mt-1">積み込み中</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 進行状況（積み込み中の場合） */}
                {departure.status === 'loading' && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <div className="animate-spin h-4 w-4 border-2 border-yellow-400 border-t-transparent rounded-full"></div>
                      <span>倉庫スタッフが積み込み作業中です...</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          </div>
        )}

        {/* 便が0件の場合 */}
        {!isLoading && !error && departures.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📦</div>
            <div className="text-xl text-gray-400">本日の担当便はありません</div>
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


