'use client'

interface OrderSliderProps {
  min: number
  max: number
  value: number
  onChange: (value: number) => void
}

export function OrderSlider({ min, max, value, onChange }: OrderSliderProps) {
  return (
    <div className="w-full px-4 py-3 bg-gray-800 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-300">
          積み込み順序
        </label>
        <span className="text-sm text-gray-400">
          {value} / {max}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
      />
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>最初</span>
        <span>最後</span>
      </div>
    </div>
  )
}
