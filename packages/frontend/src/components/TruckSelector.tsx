'use client'

import { useState, useEffect } from 'react'
import { Truck } from '@/types'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown, Plus, Trash2, Truck as TruckIcon } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

interface TruckSelectorProps {
  selectedTruck: Truck | null
  onSelect: (truck: Truck) => void
  onAddNew?: () => void
}

export function TruckSelector({ selectedTruck, onSelect, onAddNew }: TruckSelectorProps) {
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [isLoading, setIsLoading] = useState(true)

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
    e.preventDefault()
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
      <Button variant="outline" disabled>
        <TruckIcon className="h-4 w-4 mr-2" />
        読み込み中...
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="min-w-[160px] justify-between">
          <span className="flex items-center gap-2">
            <TruckIcon className="h-4 w-4" />
            {selectedTruck ? selectedTruck.name : '荷台を選択'}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        {onAddNew && (
          <>
            <DropdownMenuItem onClick={onAddNew} className="text-primary">
              <Plus className="h-4 w-4 mr-2" />
              新しい荷台を登録
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {trucks.length === 0 ? (
          <div className="px-2 py-3 text-sm text-muted-foreground">
            登録された荷台がありません
          </div>
        ) : (
          trucks.map((truck) => (
            <DropdownMenuItem
              key={truck.id}
              onClick={() => onSelect(truck)}
              className="flex items-center justify-between py-3"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium">{truck.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  入り口: {getDirectionLabel(truck.entranceDirection)}
                  {truck.maxX && truck.maxY && truck.maxZ && (
                    <span className="ml-2">
                      {((truck.maxX - (truck.minX ?? 0)) / 1000).toFixed(1)}m ×
                      {((truck.maxY - (truck.minY ?? 0)) / 1000).toFixed(1)}m ×
                      {((truck.maxZ - (truck.minZ ?? 0)) / 1000).toFixed(1)}m
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={(e) => handleDelete(e, truck)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
