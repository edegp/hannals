'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { PlacedItem } from '@/types'

interface ItemsSidebarProps {
  items: PlacedItem[]
  selectedItemId: string | null
  onItemSelect: (id: string | null) => void
  maxOrder: number
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

export function ItemsSidebar({ items, selectedItemId, onItemSelect, maxOrder }: ItemsSidebarProps) {
  const selectedItem = items.find(item => item.id === selectedItemId)
  const visibleItems = items.filter(item => (item.loadOrder ?? item.order) <= maxOrder)

  return (
    <div className="w-80 h-full bg-gray-900 border-l border-gray-700 flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white">アイテム情報</h2>
        <p className="text-sm text-gray-400">
          表示中: {visibleItems.length} / {items.length}
        </p>
      </div>

      {selectedItem ? (
        <div className="p-4 border-b border-gray-700">
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

      <div className="flex-1 overflow-y-auto p-2">
        <h3 className="text-sm font-medium text-gray-400 px-2 mb-2">アイテム一覧</h3>
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onItemSelect(item.id)}
            className={`w-full p-2 rounded-lg mb-1 text-left transition-colors ${
              item.id === selectedItemId
                ? 'bg-blue-600 text-white'
                : (item.loadOrder ?? item.order) <= maxOrder
                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                : 'bg-gray-800/50 text-gray-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium truncate">{item.name || item.id}</span>
              <span className="text-xs ml-2">#{item.loadOrder ?? item.order}</span>
            </div>
            {item.destination && (
              <div className="text-xs text-yellow-400 truncate">{item.destination}</div>
            )}
            <div className="text-xs mt-1 opacity-70">
              {item.x_mm}×{item.y_mm}×{item.z_mm}mm / {item.weight_kg}kg {item.fragile && '🔴'}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
