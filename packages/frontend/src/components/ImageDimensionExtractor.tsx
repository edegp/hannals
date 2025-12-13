'use client'

import { useState, useRef } from 'react'
import { Item } from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

interface ExtractedItem {
  id: string
  name?: string
  x_mm: number
  y_mm: number
  z_mm: number
  weight_kg?: number
  fragile?: boolean
  rot_xy?: boolean  // 水平面での回転を許可
}

interface ImageDimensionExtractorProps {
  onItemsExtracted: (items: Item[]) => void
  onClose: () => void
}

export function ImageDimensionExtractor({ onItemsExtracted, onClose }: ImageDimensionExtractorProps) {
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [rawResponse, setRawResponse] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedImage(file)
      setPreviewUrl(URL.createObjectURL(file))
      setExtractedItems([])
      setError(null)
      setRawResponse(null)
    }
  }

  const handleExtract = async () => {
    if (!selectedImage) return

    setIsExtracting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('image', selectedImage)

      const response = await fetch(`${API_URL}/api/dimensions/extract`, {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (result.success) {
        setExtractedItems(result.items)
        setRawResponse(result.rawResponse || null)
      } else {
        setError(result.error || '寸法の抽出に失敗しました')
        setRawResponse(result.rawResponse || null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '通信エラーが発生しました')
    } finally {
      setIsExtracting(false)
    }
  }

  const handleConfirm = () => {
    // ExtractedItem を Item に変換（order を追加）
    const items: Item[] = extractedItems.map((item, index) => ({
      id: item.id,
      x_mm: item.x_mm,
      y_mm: item.y_mm,
      z_mm: item.z_mm,
      order: index + 1,
      weight_kg: item.weight_kg ?? 1.0,
      fragile: item.fragile ?? false,
      rot_xy: item.rot_xy ?? true,
    }))
    onItemsExtracted(items)
  }

  const handleEditItem = (index: number, field: keyof ExtractedItem, value: number | boolean | string) => {
    setExtractedItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">画像から寸法を抽出</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 画像選択エリア */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />

            {previewUrl ? (
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="Selected"
                  className="w-full h-64 object-contain bg-gray-900 rounded"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-2 right-2 px-3 py-1 bg-gray-700 text-white text-sm rounded hover:bg-gray-600"
                >
                  変更
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-64 border-2 border-dashed border-gray-600 rounded flex flex-col items-center justify-center text-gray-400 hover:border-gray-500 hover:text-gray-300"
              >
                <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>クリックして画像を選択</span>
              </button>
            )}

            <button
              onClick={handleExtract}
              disabled={!selectedImage || isExtracting}
              className="w-full mt-4 px-4 py-3 bg-blue-500 text-white rounded disabled:opacity-50 hover:bg-blue-400"
            >
              {isExtracting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  AI解析中...
                </span>
              ) : (
                'AIで寸法を抽出'
              )}
            </button>

            {error && (
              <div className="mt-4 p-3 bg-red-900 text-red-200 rounded text-sm">
                {error}
              </div>
            )}

            {rawResponse && (
              <details className="mt-4">
                <summary className="text-gray-400 text-sm cursor-pointer hover:text-gray-300">
                  AIレスポンス詳細
                </summary>
                <pre className="mt-2 p-2 bg-gray-900 text-gray-300 text-xs rounded overflow-x-auto">
                  {rawResponse}
                </pre>
              </details>
            )}
          </div>

          {/* 抽出結果エリア */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-medium text-white">荷物リスト</h3>
              <button
                onClick={() => {
                  const newId = `item_${extractedItems.length + 1}`
                  setExtractedItems([...extractedItems, {
                    id: newId,
                    name: '新しい荷物',
                    x_mm: 300,
                    y_mm: 300,
                    z_mm: 300,
                    weight_kg: 1.0,
                    fragile: false,
                    rot_xy: true,
                  }])
                }}
                className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-400"
              >
                + 手動追加
              </button>
            </div>

            {extractedItems.length === 0 ? (
              <div className="text-gray-400 text-center py-8">
                <p className="mb-4">画像をアップロードして「AIで寸法を抽出」をクリック</p>
                <p className="text-sm">または「手動追加」ボタンで直接入力</p>
              </div>
            ) : (
              <div className="space-y-3">
                {extractedItems.map((item, index) => (
                  <div key={item.id} className="p-3 bg-gray-700 rounded">
                    <div className="flex items-center justify-between mb-2">
                      <input
                        type="text"
                        value={item.name || item.id}
                        onChange={(e) => handleEditItem(index, 'name', e.target.value)}
                        className="bg-transparent text-white font-medium border-b border-transparent hover:border-gray-500 focus:border-blue-400 outline-none"
                      />
                      <div className="flex items-center gap-2">
                        {item.fragile && (
                          <span className="px-2 py-0.5 bg-yellow-600 text-yellow-100 text-xs rounded">
                            壊れ物
                          </span>
                        )}
                        <button
                          onClick={() => {
                            setExtractedItems(prev => prev.filter((_, i) => i !== index))
                          }}
                          className="text-red-400 hover:text-red-300 p-1"
                          title="削除"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <label className="text-gray-400 text-xs">幅 (mm)</label>
                        <input
                          type="number"
                          value={item.x_mm}
                          onChange={(e) => handleEditItem(index, 'x_mm', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1 bg-gray-600 text-white rounded"
                        />
                      </div>
                      <div>
                        <label className="text-gray-400 text-xs">奥行き (mm)</label>
                        <input
                          type="number"
                          value={item.y_mm}
                          onChange={(e) => handleEditItem(index, 'y_mm', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1 bg-gray-600 text-white rounded"
                        />
                      </div>
                      <div>
                        <label className="text-gray-400 text-xs">高さ (mm)</label>
                        <input
                          type="number"
                          value={item.z_mm}
                          onChange={(e) => handleEditItem(index, 'z_mm', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1 bg-gray-600 text-white rounded"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                      <div>
                        <label className="text-gray-400 text-xs">重量 (kg)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={item.weight_kg ?? ''}
                          onChange={(e) => handleEditItem(index, 'weight_kg', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 bg-gray-600 text-white rounded"
                        />
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.fragile ?? false}
                            onChange={(e) => handleEditItem(index, 'fragile', e.target.checked)}
                            className="w-4 h-4"
                          />
                          壊れ物
                        </label>
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.rot_xy ?? true}
                            onChange={(e) => handleEditItem(index, 'rot_xy', e.target.checked)}
                            className="w-4 h-4"
                          />
                          回転可
                        </label>
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  onClick={handleConfirm}
                  className="w-full mt-4 px-4 py-3 bg-green-500 text-white rounded hover:bg-green-400"
                >
                  この荷物リストを使用
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
