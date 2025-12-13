import { Hono } from 'hono'
import { prisma } from '../lib/prisma'

interface Item {
  id: string
  x_mm: number
  y_mm: number
  z_mm: number
  order: number
  weight_kg: number
  fragile: boolean
  rot_xy: boolean
}

interface PlaceRequest {
  cargoAreaId: string
  items: Item[]
}

export const itemsRoutes = new Hono()

// 配置済みアイテム取得
itemsRoutes.get('/:cargoAreaId', async (c) => {
  const cargoAreaId = c.req.param('cargoAreaId')
  const items = await prisma.placedItem.findMany({
    where: { cargoAreaId },
    orderBy: { order: 'asc' }
  })
  return c.json(items)
})

// 荷物配置計算＆保存
itemsRoutes.post('/place', async (c) => {
  const body = await c.req.json<PlaceRequest>()
  const { cargoAreaId, items } = body

  // 積載領域を取得
  const cargoArea = await prisma.cargoArea.findUnique({
    where: { id: cargoAreaId }
  })

  if (!cargoArea) {
    return c.json({ error: 'Cargo area not found' }, 404)
  }

  // 既存のアイテムを削除
  await prisma.placedItem.deleteMany({
    where: { cargoAreaId }
  })

  // 積載領域のサイズ
  const areaWidth = cargoArea.maxX - cargoArea.minX
  const areaDepth = cargoArea.maxY - cargoArea.minY
  const areaHeight = cargoArea.maxZ - cargoArea.minZ

  // 簡易3Dビンパッキングアルゴリズム
  // 1. 重いものから配置（下に）
  // 2. 壊れ物は最後に配置（上に）
  const sortedItems = [...items].sort((a, b) => {
    // 壊れ物は後ろに
    if (a.fragile !== b.fragile) return a.fragile ? 1 : -1
    // 重いものを先に
    return b.weight_kg - a.weight_kg
  })

  const placedItems: Array<{
    itemId: string
    x_mm: number
    y_mm: number
    z_mm: number
    order: number
    weight_kg: number
    fragile: boolean
    rot_xy: boolean
    posX: number
    posY: number
    posZ: number
    rotation: number
  }> = []

  // 占有領域を追跡
  type OccupiedSpace = { x: number; y: number; z: number; w: number; d: number; h: number }
  const occupied: OccupiedSpace[] = []

  // 配置可能な位置を探す
  const findPosition = (item: Item): { x: number; y: number; z: number; rotation: number } | null => {
    const width = item.x_mm
    const depth = item.y_mm
    const height = item.z_mm

    // グリッド探索（10mm単位）
    const step = 10
    for (let z = 0; z <= areaHeight - height; z += step) {
      for (let y = 0; y <= areaDepth - depth; y += step) {
        for (let x = 0; x <= areaWidth - width; x += step) {
          if (!isColliding(x, y, z, width, depth, height, occupied)) {
            return { x, y, z, rotation: 0 }
          }
        }
      }
    }

    // 回転可能な場合、90度回転して再試行
    if (item.rot_xy) {
      for (let z = 0; z <= areaHeight - height; z += step) {
        for (let y = 0; y <= areaDepth - width; y += step) {
          for (let x = 0; x <= areaWidth - depth; x += step) {
            if (!isColliding(x, y, z, depth, width, height, occupied)) {
              return { x, y, z, rotation: 90 }
            }
          }
        }
      }
    }

    return null
  }

  // 衝突判定
  const isColliding = (
    x: number, y: number, z: number,
    w: number, d: number, h: number,
    spaces: OccupiedSpace[]
  ): boolean => {
    for (const space of spaces) {
      if (
        x < space.x + space.w &&
        x + w > space.x &&
        y < space.y + space.d &&
        y + d > space.y &&
        z < space.z + space.h &&
        z + h > space.z
      ) {
        return true
      }
    }
    return false
  }

  const unplacedItems: Item[] = []

  for (const item of sortedItems) {
    const position = findPosition(item)
    if (position) {
      const width = position.rotation === 90 ? item.y_mm : item.x_mm
      const depth = position.rotation === 90 ? item.x_mm : item.y_mm

      occupied.push({
        x: position.x,
        y: position.y,
        z: position.z,
        w: width,
        d: depth,
        h: item.z_mm
      })

      placedItems.push({
        itemId: item.id,
        x_mm: item.x_mm,
        y_mm: item.y_mm,
        z_mm: item.z_mm,
        order: item.order,
        weight_kg: item.weight_kg,
        fragile: item.fragile,
        rot_xy: item.rot_xy,
        posX: cargoArea.minX + position.x,
        posY: cargoArea.minY + position.y,
        posZ: cargoArea.minZ + position.z,
        rotation: position.rotation
      })
    } else {
      unplacedItems.push(item)
    }
  }

  // DBに保存
  if (placedItems.length > 0) {
    await prisma.placedItem.createMany({
      data: placedItems.map(item => ({
        ...item,
        cargoAreaId
      }))
    })
  }

  return c.json({
    success: true,
    placedItems,
    unplacedItems
  })
})

// アイテム削除
itemsRoutes.delete('/:cargoAreaId', async (c) => {
  const cargoAreaId = c.req.param('cargoAreaId')
  await prisma.placedItem.deleteMany({
    where: { cargoAreaId }
  })
  return c.json({ success: true })
})
