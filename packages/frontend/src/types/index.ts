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
  items?: PlacedItem[]  // 一覧取得時は含まれない
  _count?: {
    items: number
  }
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
  loadOrder?: number | null    // 積み込み順番（1から始まる）
  isLoaded?: boolean            // 積み込み済み
  loadedAt?: string | null      // 積み込み日時
  isDelivered?: boolean         // 配送済み
  deliveredAt?: string | null    // 配送日時
  objData?: string | null        // 3DモデルOBJデータ
  mtlData?: string | null        // 3DモデルMTLデータ
  itemId?: string               // 外部ID（ユーザー指定、PrismaのitemIdフィールド）
}

// 画面モード
export type ViewerMode = 'loading' | 'delivery'

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
