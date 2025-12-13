/**
 * モックアイテム生成器
 * 指定された箱サイズからランダムにアイテムを生成し、
 * 指定した積載率になるようにする
 */

// 利用可能な箱サイズ
const BOX_TYPES = [
  { id: "XM01", x: 286, y: 213, z: 24, description: "薄型・メール便サイズ" },
  { id: "XM02", x: 232, y: 133, z: 22, description: "CD/DVD用・小型" },
  { id: "XY05", x: 250, y: 180, z: 120, description: "小型・標準" },
  { id: "X08", x: 315, y: 245, z: 105, description: "A4サイズ相当・中型" },
  { id: "XY13", x: 330, y: 255, z: 30, description: "薄型・中サイズ" },
  { id: "X11", x: 405, y: 305, z: 255, description: "大きめの標準サイズ" },
  { id: "X12", x: 485, y: 325, z: 295, description: "大型" },
] as const

// 2トン車の標準的な荷台サイズ（mm）
const TWO_TON_TRUCK = {
  width: 1700,   // x
  depth: 3100,   // y
  height: 1800,  // z
}

export interface GeneratedItem {
  id: string
  x_mm: number
  y_mm: number
  z_mm: number
  order: number
  weight_kg: number
  fragile: boolean
  rot_xy: boolean
}

export interface GenerateOptions {
  /** 目標積載率 (0.0 - 1.0) */
  targetLoadRate?: number
  /** 荷台サイズ（mm） */
  truckSize?: {
    width: number
    depth: number
    height: number
  }
  /** 壊れ物の割合 (0.0 - 1.0) */
  fragileRate?: number
  /** 回転不可の割合 (0.0 - 1.0) */
  noRotateRate?: number
}

/**
 * 箱の体積を計算（mm³）
 */
function calculateVolume(x: number, y: number, z: number): number {
  return x * y * z
}

/**
 * ランダムな重量を生成（体積に基づく）
 * 密度: 100-400 kg/m³ の範囲でランダム
 */
function generateWeight(x: number, y: number, z: number): number {
  const volumeM3 = (x / 1000) * (y / 1000) * (z / 1000)
  const density = 100 + Math.random() * 300 // 100-400 kg/m³
  const weight = volumeM3 * density
  return Math.round(weight * 10) / 10 // 小数点1桁
}

/**
 * ランダムなアイテムIDを生成
 */
function generateItemId(boxType: string, index: number): string {
  const suffix = String(index).padStart(3, '0')
  return `${boxType}-${suffix}`
}

/**
 * モックアイテムを生成
 */
export function generateMockItems(options: GenerateOptions = {}): { items: GeneratedItem[] } {
  const {
    targetLoadRate = 0.8,
    truckSize = TWO_TON_TRUCK,
    fragileRate = 0.15,
    noRotateRate = 0.2,
  } = options

  const truckVolume = calculateVolume(truckSize.width, truckSize.depth, truckSize.height)
  const targetVolume = truckVolume * targetLoadRate

  const items: GeneratedItem[] = []
  let currentVolume = 0
  let itemIndex = 1

  // 目標体積に達するまでアイテムを追加
  while (currentVolume < targetVolume) {
    // ランダムに箱タイプを選択
    const boxType = BOX_TYPES[Math.floor(Math.random() * BOX_TYPES.length)]
    const itemVolume = calculateVolume(boxType.x, boxType.y, boxType.z)

    // 追加しても目標の110%を超えない場合のみ追加
    if (currentVolume + itemVolume <= targetVolume * 1.1) {
      const item: GeneratedItem = {
        id: generateItemId(boxType.id, itemIndex),
        x_mm: boxType.x,
        y_mm: boxType.y,
        z_mm: boxType.z,
        order: 0, // 後で設定
        weight_kg: generateWeight(boxType.x, boxType.y, boxType.z),
        fragile: Math.random() < fragileRate,
        rot_xy: Math.random() >= noRotateRate,
      }

      items.push(item)
      currentVolume += itemVolume
      itemIndex++
    } else {
      // 大きすぎる場合は小さい箱を探す
      const smallerBoxes = BOX_TYPES.filter(
        b => calculateVolume(b.x, b.y, b.z) <= (targetVolume * 1.1 - currentVolume)
      )

      if (smallerBoxes.length === 0) {
        break // これ以上入らない
      }

      const smallBox = smallerBoxes[Math.floor(Math.random() * smallerBoxes.length)]
      const item: GeneratedItem = {
        id: generateItemId(smallBox.id, itemIndex),
        x_mm: smallBox.x,
        y_mm: smallBox.y,
        z_mm: smallBox.z,
        order: 0,
        weight_kg: generateWeight(smallBox.x, smallBox.y, smallBox.z),
        fragile: Math.random() < fragileRate,
        rot_xy: Math.random() >= noRotateRate,
      }

      items.push(item)
      currentVolume += calculateVolume(smallBox.x, smallBox.y, smallBox.z)
      itemIndex++
    }

    // 安全のため最大1000アイテムまで
    if (items.length >= 1000) break
  }

  // 重量でソートして順序を割り当て（重いものを先に積む）
  items.sort((a, b) => b.weight_kg - a.weight_kg)

  // 壊れ物は後ろ（上部）に配置
  items.sort((a, b) => {
    if (a.fragile && !b.fragile) return 1
    if (!a.fragile && b.fragile) return -1
    return 0
  })

  // orderを割り当て
  items.forEach((item, index) => {
    item.order = index + 1
  })

  const actualLoadRate = currentVolume / truckVolume
  console.log(`Generated ${items.length} items, load rate: ${(actualLoadRate * 100).toFixed(1)}%`)

  return { items }
}

/**
 * 特定の箱タイプの数を指定して生成
 */
export function generateItemsByCount(
  counts: Partial<Record<string, number>>,
  options: Omit<GenerateOptions, 'targetLoadRate'> = {}
): { items: GeneratedItem[] } {
  const { fragileRate = 0.15, noRotateRate = 0.2 } = options

  const items: GeneratedItem[] = []
  let itemIndex = 1

  for (const [boxId, count] of Object.entries(counts)) {
    const boxType = BOX_TYPES.find(b => b.id === boxId)
    if (!boxType || !count) continue

    for (let i = 0; i < count; i++) {
      const item: GeneratedItem = {
        id: generateItemId(boxType.id, itemIndex),
        x_mm: boxType.x,
        y_mm: boxType.y,
        z_mm: boxType.z,
        order: 0,
        weight_kg: generateWeight(boxType.x, boxType.y, boxType.z),
        fragile: Math.random() < fragileRate,
        rot_xy: Math.random() >= noRotateRate,
      }
      items.push(item)
      itemIndex++
    }
  }

  // ソートとorder割り当て
  items.sort((a, b) => b.weight_kg - a.weight_kg)
  items.sort((a, b) => {
    if (a.fragile && !b.fragile) return 1
    if (!a.fragile && b.fragile) return -1
    return 0
  })
  items.forEach((item, index) => {
    item.order = index + 1
  })

  return { items }
}
