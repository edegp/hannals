'use client'

import { useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { PlacedItem, ViewerMode } from '@/types'

interface ItemsSidebarProps {
  items: PlacedItem[]
  completedItems?: PlacedItem[]
  selectedItemId: string | null
  onItemSelect: (id: string | null) => void
  maxOrder: number
  isOpen?: boolean
  onToggle?: () => void
  mode?: ViewerMode
  onStatusChange?: (itemId: string) => void
  onStatusUndo?: (itemId: string) => void
}

function ItemPreview({ item }: { item: PlacedItem }) {
  const scale = 0.01
  const width = item.x_mm * scale
  const depth = item.y_mm * scale
  const height = item.z_mm * scale
  const color = item.fragile ? '#ff6b6b' : '#45b7d1'

  return (
    <mesh>
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

export function ItemsSidebar({ items, completedItems = [], selectedItemId, onItemSelect, maxOrder, isOpen = true, onToggle, mode, onStatusChange, onStatusUndo }: ItemsSidebarProps) {
  const allItems = [...items, ...completedItems]
  const selectedItem = allItems.find(item => item.id === selectedItemId)
  const getItemOrder = (item: PlacedItem) => (mode === 'delivery' ? item.order : (item.loadOrder ?? item.order))
  const visibleItems = items.filter(item => getItemOrder(item) <= maxOrder)

  const scrollAreaRef = useRef<HTMLDivElement | null>(null)
  const pendingHeaderRef = useRef<HTMLHeadingElement | null>(null)
  const completedHeaderRef = useRef<HTMLHeadingElement | null>(null)

  const scrollToPending = () => {
    pendingHeaderRef.current?.scrollIntoView({ block: 'start' })
  }

  const scrollToCompleted = () => {
    completedHeaderRef.current?.scrollIntoView({ block: 'start' })
  }

  const undoLabel = mode === 'loading' ? '積み込み取消' : '配送取消'

  const resolveUndoTargetId = () => {
    if (!mode || !onStatusUndo || completedItems.length === 0) return null

    const selectedCompleted = selectedItemId
      ? completedItems.find((i) => i.id === selectedItemId)
      : undefined

    if (selectedCompleted) return selectedCompleted.id

    const getCompletedAtMs = (item: PlacedItem) => {
      const dateStr = mode === 'loading' ? item.loadedAt : item.deliveredAt
      const ms = dateStr ? Date.parse(dateStr) : NaN
      return Number.isFinite(ms) ? ms : -1
    }

    let latest = completedItems[0]
    let latestMs = getCompletedAtMs(latest)
    for (const item of completedItems) {
      const ms = getCompletedAtMs(item)
      if (ms > latestMs) {
        latest = item
        latestMs = ms
      }
    }

    return latest?.id ?? null
  }

  return (
    <>
      {/* モバイル用トグルボタン */}
      <button
        onClick={onToggle}
        className="lg:hidden fixed bottom-32 right-4 z-50 bg-blue-600 text-white p-3 rounded-full shadow-lg"
      >
        {isOpen ? '✕' : '📋'}
      </button>

      {/* サイドバー */}
      <div className={`
        fixed lg:relative right-0 top-0 bottom-0 z-40 lg:z-auto
        w-80 flex-shrink-0 bg-gray-900 border-l border-gray-700 flex flex-col h-full
        transform transition-transform duration-300
        ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-white">アイテム情報</h2>
            {mode && onStatusUndo && completedItems.length > 0 && (
              <button
                onClick={() => {
                  const targetId = resolveUndoTargetId()
                  if (targetId) onStatusUndo(targetId)
                }}
                className="px-2 py-1 rounded text-xs bg-gray-700 text-gray-200 hover:bg-gray-600"
              >
                ↩︎ {undoLabel}
              </button>
            )}
          </div>
          <p className="text-sm text-gray-400">
            表示中: {visibleItems.length} / {items.length}
          </p>

          {(items.length > 0 || completedItems.length > 0) && (
            <div className="mt-3 flex gap-2">
              {items.length > 0 && (
                <button
                  onClick={scrollToPending}
                  className="px-2 py-1 rounded text-xs bg-gray-700 text-gray-200 hover:bg-gray-600"
                >
                  {mode === 'loading' ? '積み込み待ちへ' : mode === 'delivery' ? '配送待ちへ' : '一覧へ'}
                </button>
              )}
              {completedItems.length > 0 && (
                <button
                  onClick={scrollToCompleted}
                  className="px-2 py-1 rounded text-xs bg-gray-700 text-gray-200 hover:bg-gray-600"
                >
                  {mode === 'loading' ? '積み込み済みへ' : mode === 'delivery' ? '配送済みへ' : '完了へ'}
                </button>
              )}
            </div>
          )}
        </div>

        {selectedItem ? (
          <div className="p-4 border-b border-gray-700">
            {/* 戻るボタン */}
            <button
              onClick={() => onItemSelect(null)}
              className="flex items-center text-blue-400 hover:text-blue-300 mb-3 text-sm"
            >
              ← 一覧に戻る
            </button>
            <h3 className="font-medium text-white mb-1">{selectedItem.name || selectedItem.id}</h3>
            <p className="text-xs text-gray-500 mb-3">{selectedItem.id}</p>

            <div className="h-32 bg-gray-800 rounded-lg mb-3">
              <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
                <ambientLight intensity={0.7} />
                <directionalLight position={[5, 5, 5]} />
                <ItemPreview item={selectedItem} />
                <OrbitControls enableZoom={false} />
              </Canvas>
            </div>

            <div className="space-y-2 text-sm">
              {selectedItem.destination && (
                <div className="flex justify-between">
                  <span className="text-gray-400">配送先</span>
                  <span className="text-yellow-400">{selectedItem.destination}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">サイズ (mm)</span>
                <span className="text-white">
                  {selectedItem.x_mm} × {selectedItem.y_mm} × {selectedItem.z_mm}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">重量</span>
                <span className="text-white">{selectedItem.weight_kg} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">配送順</span>
                <span className="text-white">#{selectedItem.order}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">積込順</span>
                <span className="text-white">#{selectedItem.loadOrder ?? '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">壊れ物</span>
                <span className={selectedItem.fragile ? 'text-red-400' : 'text-green-400'}>
                  {selectedItem.fragile ? 'はい' : 'いいえ'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">位置 (mm)</span>
                <span className="text-white text-xs">
                  ({selectedItem.posX.toFixed(0)}, {selectedItem.posY.toFixed(0)}, {selectedItem.posZ.toFixed(0)})
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 text-center text-gray-500">
            アイテムを選択してください
          </div>
        )}

        <div ref={scrollAreaRef} className="flex-1 overflow-y-auto p-2">
          {/* 未完了アイテム */}
          <h3 ref={pendingHeaderRef} className="text-sm font-medium text-gray-400 px-2 mb-2">
            {mode === 'loading' ? '積み込み待ち' : mode === 'delivery' ? '配送待ち' : 'アイテム一覧'}
            {items.length > 0 && <span className="ml-1">({items.length})</span>}
          </h3>
          {items.map((item) => (
            <div key={item.id} className="mb-1">
              <button
                onClick={() => onItemSelect(item.id)}
                className={`w-full p-2 rounded-lg text-left transition-colors ${item.id === selectedItemId
                    ? 'bg-blue-600 text-white'
                    : getItemOrder(item) <= maxOrder
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-gray-800/50 text-gray-500'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium truncate">{item.name || item.id}</span>
                  <span className="text-xs ml-2">
                    #{getItemOrder(item)}
                  </span>
                </div>
                {item.destination && (
                  <div className="text-xs text-yellow-400 truncate">{item.destination}</div>
                )}
                <div className="text-xs mt-1 opacity-70">
                  {item.x_mm}×{item.y_mm}×{item.z_mm}mm / {item.weight_kg}kg {item.fragile && '🔴'}
                </div>
              </button>
              {mode && onStatusChange && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onStatusChange(item.id)
                  }}
                  className={`w-full mt-1 py-1.5 rounded text-sm font-medium transition-colors ${mode === 'loading'
                      ? 'bg-green-600 hover:bg-green-500 text-white'
                      : 'bg-orange-600 hover:bg-orange-500 text-white'
                    }`}
                >
                  {mode === 'loading' ? '積み込み完了' : '配送完了'}
                </button>
              )}
            </div>
          ))}

          {/* 完了済みアイテム */}
          {completedItems.length > 0 && (
            <>
              <h3 ref={completedHeaderRef} className="text-sm font-medium text-gray-400 px-2 mb-2 mt-4 border-t border-gray-700 pt-4">
                {mode === 'loading' ? '積み込み済み' : mode === 'delivery' ? '配送済み' : '完了'}
                <span className="ml-1">({completedItems.length})</span>
              </h3>
              {completedItems.map((item) => (
                <div key={item.id} className="mb-1">
                  <button
                    onClick={() => onItemSelect(item.id)}
                    className={`w-full p-2 rounded-lg text-left transition-colors ${item.id === selectedItemId
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800/50 text-gray-500 hover:bg-gray-700'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{item.name || item.id}</span>
                      <span className="text-xs ml-2 text-green-400">✓</span>
                    </div>
                    {item.destination && (
                      <div className="text-xs text-yellow-400/50 truncate">{item.destination}</div>
                    )}
                    <div className="text-xs mt-1 opacity-50">
                      {item.x_mm}×{item.y_mm}×{item.z_mm}mm / {item.weight_kg}kg
                    </div>
                  </button>
                  {mode && onStatusUndo && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onStatusUndo(item.id)
                      }}
                      className="w-full mt-1 py-1.5 rounded text-sm font-medium transition-colors bg-gray-600 hover:bg-gray-500 text-white"
                    >
                      {mode === 'loading' ? '積み込み取消' : '配送取消'}
                    </button>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  )
}
