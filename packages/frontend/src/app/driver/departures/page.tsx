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
        console.log('[Departures] API URL:', API_URL)
        console.log('[Departures] 配置一覧を取得開始...')
        
        // 配置一覧を取得
        const placementsResponse = await fetch(`${API_URL}/api/placements`)
        console.log('[Departures] 配置一覧レスポンス:', {
          status: placementsResponse.status,
          ok: placementsResponse.ok,
          url: `${API_URL}/api/placements`
        })
        
        if (!placementsResponse.ok) {
          throw new Error('配置一覧の取得に失敗しました')
        }
        const placements: Placement[] = await placementsResponse.json()
        console.log('[Departures] 取得した配置一覧:', placements)
        console.log('[Departures] 配置数:', placements.length)

        // 各配置の詳細を取得（itemsのステータスを含む）
        console.log('[Departures] 各配置の詳細を取得開始...')
        const departurePromises = placements.map(async (placement) => {
          console.log(`[Departures] 配置詳細を取得: ${placement.id}`)
          const detailResponse = await fetch(`${API_URL}/api/placements/${placement.id}`)
          console.log(`[Departures] 配置詳細レスポンス (${placement.id}):`, {
            status: detailResponse.status,
            ok: detailResponse.ok
          })
          
          if (!detailResponse.ok) {
            console.warn(`[Departures] 配置詳細の取得に失敗: ${placement.id}`)
            return null
          }
          const detail: Placement = await detailResponse.json()
          console.log(`[Departures] 配置詳細データ (${placement.id}):`, {
            id: detail.id,
            truckId: detail.truckId,
            truckName: detail.truck?.name,
            itemsCount: detail.items?.length || 0,
            hasItems: !!detail.items,
            items: detail.items?.slice(0, 3).map(item => ({
              id: item.id,
              itemId: item.itemId,
              order: item.order,
              isLoaded: item.isLoaded,
              isDelivered: item.isDelivered
            }))
          })
          
          // itemsが存在しない場合は空配列として扱う
          if (!detail.items) {
            console.warn(`[Departures] 配置にitemsプロパティがありません: ${placement.id}`)
            detail.items = []
          }
          
          if (detail.items.length === 0) {
            console.warn(`[Departures] 配置に荷物が含まれていません（荷物0個として表示）: ${placement.id}`)
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
        console.log('[Departures] 有効な配置詳細数:', placementDetails.length)
        console.log('[Departures] 各配置の荷物数:', placementDetails.map(p => ({
          id: p.id,
          itemCount: p.items?.length || 0
        })))

        // ステータスを判定してDeparture型に変換
        console.log('[Departures] ステータス判定とDeparture型への変換開始...')
        const departureList: Departure[] = placementDetails.map((placement) => {
          const items = placement.items || []
          const itemCount = items.length
          console.log(`[Departures] 配置 ${placement.id} の処理:`, {
            itemCount,
            itemsSample: items.slice(0, 3).map(item => ({
              id: item.id,
              itemId: item.itemId,
              order: item.order,
              isLoaded: item.isLoaded,
              isDelivered: item.isDelivered
            }))
          })

          // 配送先数（orderのユニークな値の数）
          const uniqueOrders = new Set(items.map((item) => item.order))
          const estimatedStops = uniqueOrders.size
          console.log(`[Departures] 配置 ${placement.id} の配送先数:`, estimatedStops, 'ユニークなorder:', Array.from(uniqueOrders))

          // ステータス判定
          // - 全ての荷物が積み込み済み → 'loaded'
          // - 一部でも積み込み済み → 'loading'
          // - 全て配送済み → 'completed'
          // - それ以外 → 'loading'
          const allLoaded = items.length > 0 && items.every((item) => item.isLoaded === true)
          const allDelivered = items.length > 0 && items.every((item) => item.isDelivered === true)
          const someLoaded = items.some((item) => item.isLoaded === true)
          
          const loadedCount = items.filter((item) => item.isLoaded === true).length
          const deliveredCount = items.filter((item) => item.isDelivered === true).length
          
          console.log(`[Departures] 配置 ${placement.id} のステータス判定:`, {
            allLoaded,
            allDelivered,
            someLoaded,
            loadedCount,
            deliveredCount,
            totalItems: items.length
          })

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
          console.log(`[Departures] 配置 ${placement.id} の判定されたステータス:`, status)

          // 出発予定時刻（createdAtから計算、またはデフォルト値）
          const createdAt = new Date(placement.createdAt)
          const departureTime = createdAt.toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
          })
          console.log(`[Departures] 配置 ${placement.id} の出発予定時刻:`, {
            createdAt: placement.createdAt,
            departureTime
          })

          const departure: Departure = {
            binId: placement.id,
            vehicleName: placement.truck?.name || '未設定の車両',
            departureTime,
            estimatedStops,
            status,
            itemCount,
            driverName: '山田太郎', // TODO: 実際のドライバー情報を取得
          }
          
          console.log(`[Departures] 変換されたDeparture (${placement.id}):`, departure)
          return departure
        })

        // 出発予定時刻でソート
        console.log('[Departures] ソート前のdepartureList:', departureList)
        departureList.sort((a, b) => {
          const timeA = a.departureTime.replace(':', '')
          const timeB = b.departureTime.replace(':', '')
          return timeA.localeCompare(timeB)
        })
        console.log('[Departures] ソート後のdepartureList:', departureList)
        console.log('[Departures] 最終的な出発便数:', departureList.length)

        setDepartures(departureList)
        console.log('[Departures] データ取得完了')
      } catch (err) {
        console.error('[Departures] エラーが発生しました:', err)
        console.error('[Departures] エラーの詳細:', {
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          name: err instanceof Error ? err.name : undefined
        })
        setError(err instanceof Error ? err.message : 'データの取得に失敗しました')
      } finally {
        console.log('[Departures] ローディング完了')
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


