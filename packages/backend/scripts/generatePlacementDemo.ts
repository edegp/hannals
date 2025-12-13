/**
 * 80%積載量のデモデータを生成
 * - 最適配置（隙間なく詰める）
 * - ランダム配置（適当に詰める）
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs'
import path from 'path'
import { generatePlacedItemsObj } from '../src/lib/objGenerator'

// 2tワイドロングの荷台サイズ（mm）
const TRUCK = {
  width: 2000,   // X
  depth: 4400,   // Y
  height: 2000,  // Z
}

// 箱タイプ
const BOX_TYPES = [
  { id: "XM01", x: 286, y: 213, z: 24 },
  { id: "XM02", x: 232, y: 133, z: 22 },
  { id: "XY05", x: 250, y: 180, z: 120 },
  { id: "X08", x: 315, y: 245, z: 105 },
  { id: "XY13", x: 330, y: 255, z: 30 },
  { id: "X11", x: 405, y: 305, z: 255 },
  { id: "X12", x: 485, y: 325, z: 295 },
]

interface Item {
  id: string
  name: string        // 品目名
  destination: string // 配送先
  x_mm: number
  y_mm: number
  z_mm: number
  order: number
  weight_kg: number
  fragile: boolean
  rot_xy: boolean
}

interface PlacedItem extends Item {
  posX: number
  posY: number
  posZ: number
  rotation: number
  loadOrder: number  // 積み込み順番（1から始まる）
}

// 体積計算
function volume(x: number, y: number, z: number): number {
  return x * y * z
}

// 重量生成
function generateWeight(x: number, y: number, z: number): number {
  const volumeM3 = (x / 1000) * (y / 1000) * (z / 1000)
  const density = 150 + Math.random() * 200
  return Math.round(volumeM3 * density * 10) / 10
}

// サンプル品目名
const PRODUCT_NAMES = [
  '書籍', '衣類', '食品', '電化製品', '日用品', '化粧品', '文具', '玩具',
  '医薬品', '飲料', 'スポーツ用品', '家具', '雑貨', 'ペット用品', '工具'
]

// サンプル配送先
const DESTINATIONS = [
  '東京都渋谷区', '東京都新宿区', '東京都港区', '東京都品川区', '東京都目黒区',
  '神奈川県横浜市', '神奈川県川崎市', '千葉県千葉市', '埼玉県さいたま市',
  '大阪府大阪市', '愛知県名古屋市', '福岡県福岡市', '北海道札幌市'
]

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// 80%積載量のアイテムを生成
function generateItems(): Item[] {
  const truckVolume = volume(TRUCK.width, TRUCK.depth, TRUCK.height)
  const targetVolume = truckVolume * 0.8

  const items: Item[] = []
  let currentVolume = 0
  let index = 1

  while (currentVolume < targetVolume) {
    const boxType = BOX_TYPES[Math.floor(Math.random() * BOX_TYPES.length)]
    const itemVolume = volume(boxType.x, boxType.y, boxType.z)

    if (currentVolume + itemVolume <= targetVolume * 1.05) {
      items.push({
        id: `${boxType.id}-${String(index).padStart(3, '0')}`,
        name: randomPick(PRODUCT_NAMES),
        destination: randomPick(DESTINATIONS),
        x_mm: boxType.x,
        y_mm: boxType.y,
        z_mm: boxType.z,
        order: 0,
        weight_kg: generateWeight(boxType.x, boxType.y, boxType.z),
        fragile: Math.random() < 0.1,
        rot_xy: Math.random() > 0.15,
      })
      currentVolume += itemVolume
      index++
    } else {
      const smaller = BOX_TYPES.filter(b => volume(b.x, b.y, b.z) <= targetVolume * 1.05 - currentVolume)
      if (smaller.length === 0) break

      const box = smaller[Math.floor(Math.random() * smaller.length)]
      items.push({
        id: `${box.id}-${String(index).padStart(3, '0')}`,
        name: randomPick(PRODUCT_NAMES),
        destination: randomPick(DESTINATIONS),
        x_mm: box.x,
        y_mm: box.y,
        z_mm: box.z,
        order: 0,
        weight_kg: generateWeight(box.x, box.y, box.z),
        fragile: Math.random() < 0.1,
        rot_xy: Math.random() > 0.15,
      })
      currentVolume += volume(box.x, box.y, box.z)
      index++
    }

    if (items.length >= 2000) break
  }

  // 重い順にソート、壊れ物は後ろ
  items.sort((a, b) => b.weight_kg - a.weight_kg)
  items.sort((a, b) => (a.fragile ? 1 : 0) - (b.fragile ? 1 : 0))
  items.forEach((item, i) => item.order = i + 1)

  const rate = currentVolume / truckVolume * 100
  console.log(`Generated ${items.length} items, load rate: ${rate.toFixed(1)}%`)

  return items
}

// 最適配置（Bottom-Left-Back アルゴリズム）
// 配送順番が遅いもの（order大）を奥から配置し、早いもの（order小）を入り口近くに配置
function placeOptimal(items: Item[]): PlacedItem[] {
  const placed: PlacedItem[] = []

  // 空きスペースのリスト
  let spaces = [{ x: 0, y: 0, z: 0, w: TRUCK.width, d: TRUCK.depth, h: TRUCK.height }]

  // 配送順番の逆順（order大→小）でソート
  // 配送が遅いものを先に奥に配置し、早いものを後で入り口近くに配置
  const sortedItems = [...items].sort((a, b) => b.order - a.order)

  for (const item of sortedItems) {
    let bestSpace = -1
    let bestFit = Infinity
    let rotated = false

    // 最適な空きスペースを探す
    for (let i = 0; i < spaces.length; i++) {
      const s = spaces[i]

      // 回転なしでフィットするか
      if (item.x_mm <= s.w && item.y_mm <= s.d && item.z_mm <= s.h) {
        const waste = (s.w * s.d * s.h) - volume(item.x_mm, item.y_mm, item.z_mm)
        if (waste < bestFit) {
          bestFit = waste
          bestSpace = i
          rotated = false
        }
      }

      // 90度回転してフィットするか（rot_xyがtrueの場合）
      if (item.rot_xy && item.y_mm <= s.w && item.x_mm <= s.d && item.z_mm <= s.h) {
        const waste = (s.w * s.d * s.h) - volume(item.x_mm, item.y_mm, item.z_mm)
        if (waste < bestFit) {
          bestFit = waste
          bestSpace = i
          rotated = true
        }
      }
    }

    if (bestSpace >= 0) {
      const s = spaces[bestSpace]
      const w = rotated ? item.y_mm : item.x_mm
      const d = rotated ? item.x_mm : item.y_mm
      const h = item.z_mm

      placed.push({
        ...item,
        posX: s.x,
        posY: s.y,
        posZ: s.z,
        rotation: rotated ? 90 : 0,
        loadOrder: placed.length + 1,  // 積み込み順番
      })

      // スペースを分割
      spaces.splice(bestSpace, 1)

      // 右側のスペース
      if (s.w - w > 0) {
        spaces.push({ x: s.x + w, y: s.y, z: s.z, w: s.w - w, d: s.d, h: s.h })
      }
      // 奥側のスペース
      if (s.d - d > 0) {
        spaces.push({ x: s.x, y: s.y + d, z: s.z, w: w, d: s.d - d, h: s.h })
      }
      // 上側のスペース
      if (s.h - h > 0) {
        spaces.push({ x: s.x, y: s.y, z: s.z + h, w: w, d: d, h: s.h - h })
      }

      // 小さすぎるスペースを削除
      spaces = spaces.filter(sp => sp.w >= 100 && sp.d >= 100 && sp.h >= 20)

      // Y座標（奥行き）でソート（手前から詰める）
      spaces.sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x)
    }
  }

  // 積み込み順を再計算（下層→上層、奥→手前の順で積み込む）
  // posZ（高さ）が低いものを先に、同じ高さならposY（奥行き）が大きいものを先に
  placed.sort((a, b) => {
    // 高さ（Z）が低い順（下から上へ積み込む）
    if (a.posZ !== b.posZ) return a.posZ - b.posZ
    // 同じ高さなら奥から手前へ（Y大→Y小）
    if (a.posY !== b.posY) return b.posY - a.posY
    // 同じ位置ならX座標順
    return a.posX - b.posX
  })

  // loadOrderを振り直す
  placed.forEach((item, index) => {
    item.loadOrder = index + 1
  })

  console.log(`Optimal placement: ${placed.length}/${items.length} items placed`)
  return placed
}

// ランダム配置
function placeRandom(items: Item[]): PlacedItem[] {
  const placed: PlacedItem[] = []
  const grid: boolean[][][] = []

  // 100mm単位のグリッドを初期化
  const gridW = Math.ceil(TRUCK.width / 100)
  const gridD = Math.ceil(TRUCK.depth / 100)
  const gridH = Math.ceil(TRUCK.height / 100)

  for (let x = 0; x < gridW; x++) {
    grid[x] = []
    for (let y = 0; y < gridD; y++) {
      grid[x][y] = new Array(gridH).fill(false)
    }
  }

  // アイテムをシャッフル
  const shuffled = [...items].sort(() => Math.random() - 0.5)

  for (const item of shuffled) {
    const w = Math.ceil(item.x_mm / 100)
    const d = Math.ceil(item.y_mm / 100)
    const h = Math.ceil(item.z_mm / 100)

    // ランダムな位置を試す（最大100回）
    let placed_item = false
    for (let attempt = 0; attempt < 100 && !placed_item; attempt++) {
      const gx = Math.floor(Math.random() * (gridW - w + 1))
      const gy = Math.floor(Math.random() * (gridD - d + 1))

      // 下から積み上げる（重力）
      for (let gz = 0; gz <= gridH - h && !placed_item; gz++) {
        let canPlace = true

        // 衝突チェック
        for (let dx = 0; dx < w && canPlace; dx++) {
          for (let dy = 0; dy < d && canPlace; dy++) {
            for (let dz = 0; dz < h && canPlace; dz++) {
              if (grid[gx + dx]?.[gy + dy]?.[gz + dz]) {
                canPlace = false
              }
            }
          }
        }

        if (canPlace) {
          // グリッドをマーク
          for (let dx = 0; dx < w; dx++) {
            for (let dy = 0; dy < d; dy++) {
              for (let dz = 0; dz < h; dz++) {
                if (grid[gx + dx]?.[gy + dy]) {
                  grid[gx + dx][gy + dy][gz + dz] = true
                }
              }
            }
          }

          placed.push({
            ...item,
            posX: gx * 100,
            posY: gy * 100,
            posZ: gz * 100,
            rotation: 0,
            loadOrder: placed.length + 1,  // 積み込み順番
          })
          placed_item = true
        }
      }
    }
  }

  // 積み込み順を再計算（下層→上層、奥→手前の順で積み込む）
  placed.sort((a, b) => {
    if (a.posZ !== b.posZ) return a.posZ - b.posZ
    if (a.posY !== b.posY) return b.posY - a.posY
    return a.posX - b.posX
  })

  // loadOrderを振り直す
  placed.forEach((item, index) => {
    item.loadOrder = index + 1
  })

  console.log(`Random placement: ${placed.length}/${items.length} items placed`)
  return placed
}

// CSVに出力
function writeCSV(items: Item[], filename: string): void {
  const header = 'id,name,destination,x_mm,y_mm,z_mm,order,weight_kg,fragile,rot_xy'
  const rows = items.map(i =>
    `${i.id},${i.name},${i.destination},${i.x_mm},${i.y_mm},${i.z_mm},${i.order},${i.weight_kg},${i.fragile},${i.rot_xy}`
  )
  writeFileSync(filename, [header, ...rows].join('\n'))
  console.log(`Written: ${filename}`)
}

// 配置済みCSVに出力
function writePlacedCSV(items: PlacedItem[], filename: string): void {
  const header = 'id,name,destination,x_mm,y_mm,z_mm,order,weight_kg,fragile,rot_xy,posX,posY,posZ,rotation,loadOrder'
  const rows = items.map(i =>
    `${i.id},${i.name},${i.destination},${i.x_mm},${i.y_mm},${i.z_mm},${i.order},${i.weight_kg},${i.fragile},${i.rot_xy},${i.posX},${i.posY},${i.posZ},${i.rotation},${i.loadOrder}`
  )
  writeFileSync(filename, [header, ...rows].join('\n'))
  console.log(`Written: ${filename}`)
}

// メイン処理
async function main() {
  const outputDir = path.join(process.cwd(), '..', '..', 'docs', 'demo')
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  console.log('=== Generating 80% load items ===')
  const items = generateItems()

  // アイテムCSV出力
  writeCSV(items, path.join(outputDir, 'items_80percent.csv'))

  console.log('\n=== Optimal Placement ===')
  const optimalPlaced = placeOptimal(items)
  writePlacedCSV(optimalPlaced, path.join(outputDir, 'placed_optimal.csv'))

  const optimalObj = generatePlacedItemsObj(optimalPlaced)
  writeFileSync(path.join(outputDir, 'placed_optimal.obj'), optimalObj)
  console.log(`Written: ${path.join(outputDir, 'placed_optimal.obj')}`)

  console.log('\n=== Random Placement ===')
  const randomPlaced = placeRandom(items)
  writePlacedCSV(randomPlaced, path.join(outputDir, 'placed_random.csv'))

  const randomObj = generatePlacedItemsObj(randomPlaced)
  writeFileSync(path.join(outputDir, 'placed_random.obj'), randomObj)
  console.log(`Written: ${path.join(outputDir, 'placed_random.obj')}`)

  console.log('\n=== Summary ===')
  console.log(`Truck size: ${TRUCK.width}mm x ${TRUCK.depth}mm x ${TRUCK.height}mm`)
  console.log(`Total items: ${items.length}`)
  console.log(`Optimal placed: ${optimalPlaced.length}`)
  console.log(`Random placed: ${randomPlaced.length}`)
}

main().catch(console.error)
