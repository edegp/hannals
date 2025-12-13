'use client'

import { useState, useEffect } from 'react'
import { Truck } from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

interface TruckSelectorProps {
  selectedTruck: Truck | null
  onSelect: (truck: Truck) => void
  onAddNew?: () => void
}

export function TruckSelector({ selectedTruck, onSelect, onAddNew }: TruckSelectorProps) {
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    fetchTrucks()
  }, [])

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

  const handleDelete = async (e: React.MouseEvent, truck: Truck) => {
    e.stopPropagation()
    if (!confirm(`「${truck.name}」を削除しますか？`)) return

    try {
      const response = await fetch(`${API_URL}/api/trucks/${truck.id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        setTrucks((prev) => prev.filter((t) => t.id !== truck.id))
      }
    } catch (error) {
      console.error('Failed to delete truck:', error)
    }
  }

  const getDirectionLabel = (dir: string) => {
    switch (dir) {
      case 'front': return '前方'
      case 'back': return '後方'
      case 'left': return '左側'
      case 'right': return '右側'
      default: return dir
    }
  }

  if (isLoading) {
    return (
      <div className="text-gray-400 text-sm">読み込み中...</div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 flex items-center gap-2"
      >
        <span>{selectedTruck ? selectedTruck.name : '荷台を選択'}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-gray-800 border border-gray-600 rounded shadow-lg z-50">
          {/* 新規追加ボタン */}
          {onAddNew && (
            <button
              onClick={() => {
                setIsOpen(false)
                onAddNew()
              }}
              className="w-full px-4 py-3 text-left text-blue-400 hover:bg-gray-700 flex items-center gap-2 border-b border-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>新しい荷台を登録</span>
            </button>
          )}

          {/* 荷台リスト */}
          {trucks.length === 0 ? (
            <div className="px-4 py-3 text-gray-400 text-sm">
              登録された荷台がありません
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto">
              {trucks.map((truck) => (
                <div
                  key={truck.id}
                  onClick={() => {
                    onSelect(truck)
                    setIsOpen(false)
                  }}
                  className={`px-4 py-3 hover:bg-gray-700 cursor-pointer flex items-center justify-between ${selectedTruck?.id === truck.id ? 'bg-gray-700' : ''}`}
                >
                  <div>
                    <div className="text-white">{truck.name}</div>
                    <div className="text-xs text-gray-400">
                      入り口: {getDirectionLabel(truck.entranceDirection)}
                      {truck.maxX && truck.maxY && truck.maxZ && (
                        <span className="ml-2">
                          {((truck.maxX - (truck.minX ?? 0)) / 1000).toFixed(1)}m x
                          {((truck.maxY - (truck.minY ?? 0)) / 1000).toFixed(1)}m x
                          {((truck.maxZ - (truck.minZ ?? 0)) / 1000).toFixed(1)}m
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, truck)}
                    className="text-red-400 hover:text-red-300 p-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
