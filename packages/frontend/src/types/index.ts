// 荷台（トラック）
export interface Truck {
  id: string
  name: string
  objFilePath: string
  mtlFilePath: string | null
  entranceDirection: 'front' | 'back' | 'left' | 'right'
  minX: number | null
  minY: number | null
  minZ: number | null
  maxX: number | null
  maxY: number | null
  maxZ: number | null
  createdAt: string
  updatedAt: string
}

// 配置セッション
export interface Placement {
  id: string
  truckId: string
  truck?: Truck
  items: PlacedItem[]
  createdAt: string
}

// 荷物アイテム（入力）
export interface Item {
  id: string
  name?: string        // 品目名
  destination?: string // 配送先
  x_mm: number
  y_mm: number
  z_mm: number
  order: number
  weight_kg: number
  fragile: boolean
  rot_xy: boolean
}

// 配置済みアイテム（APIレスポンス）
export interface PlacedItem extends Item {
  posX: number
  posY: number
  posZ: number
  rotation: number
  loadOrder?: number  // 積み込み順番（1から始まる）
}

// クリック位置
export interface ClickPoint {
  x: number
  y: number
  z: number
}

// 荷台の積載領域（互換性のため残す）
export interface CargoArea {
  id?: string
  name?: string
  minX: number
  minY: number
  minZ: number
  maxX: number
  maxY: number
  maxZ: number
}
