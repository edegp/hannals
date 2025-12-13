import { Hono } from 'hono'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonValue = any
import { prisma } from '../lib/prisma'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { generateMockItems, generateItemsByCount, type GeneratedItem } from '../lib/mockItemGenerator'

// リクエストログの保存先
const REQUEST_LOG_DIR = path.join(process.cwd(), 'logs', 'requests')

export const placementsRoutes = new Hono()

// 外部APIのURL（環境変数から取得）
const EXTERNAL_API_URL = process.env.EXTERNAL_API_URL || 'http://localhost:5000'

interface InputItem {
  id: string
  x_mm: number
  y_mm: number
  z_mm: number
  order: number
  weight_kg: number
  fragile: boolean
  rot_xy: boolean
}

interface PlacedItemResult {
  id: string
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
  objData?: string
  mtlData?: string | null
}

interface ExternalApiResponse {
  success: boolean
  placedItems: PlacedItemResult[]
  unplacedItems: InputItem[]
}

// 配置一覧取得
placementsRoutes.get('/', async (c) => {
  const placements = await prisma.placement.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      truck: true,
      _count: {
        select: { items: true }
      }
    }
  })
  return c.json(placements)
})

// 配置詳細取得
placementsRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  const placement = await prisma.placement.findUnique({
    where: { id },
    include: {
      truck: true,
      items: {
        orderBy: { order: 'asc' }
      }
    }
  })
  if (!placement) {
    return c.json({ error: 'Not found' }, 404)
  }
  return c.json(placement)
})

// 配置計算リクエスト（外部API呼び出し）
placementsRoutes.post('/', async (c) => {
  const body = await c.req.json<{
    truckId: string
    items: InputItem[]
  }>()

  const { truckId, items } = body

  // 荷台を取得
  const truck = await prisma.truck.findUnique({ where: { id: truckId } })
  if (!truck) {
    return c.json({ error: 'Truck not found' }, 404)
  }

  // 3Dファイルを読み込み
  let objData: string
  let mtlData: string | null = null

  try {
    objData = await readFile(truck.objFilePath, 'utf-8')
    if (truck.mtlFilePath) {
      mtlData = await readFile(truck.mtlFilePath, 'utf-8')
    }
  } catch {
    return c.json({ error: 'Failed to read 3D files' }, 500)
  }

  // 外部APIにリクエスト
  let apiResponse: ExternalApiResponse

  try {
    const response = await fetch(`${EXTERNAL_API_URL}/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        truck: {
          objData,
          mtlData,
          entranceDirection: truck.entranceDirection,
        },
        items,
      }),
    })

    if (!response.ok) {
      throw new Error(`External API returned ${response.status}`)
    }

    apiResponse = await response.json()
  } catch (error) {
    console.error('External API error:', error)
    // 外部APIが利用不可の場合はフォールバック（簡易配置アルゴリズム）
    apiResponse = fallbackPlacement(items, truck)
  }

  // 配置結果をDBに保存
  const placement = await prisma.placement.create({
    data: {
      truckId,
      resultData: apiResponse as JsonValue,
      items: {
        create: apiResponse.placedItems.map((item) => ({
          itemId: item.id,
          x_mm: item.x_mm,
          y_mm: item.y_mm,
          z_mm: item.z_mm,
          order: item.order,
          weight_kg: item.weight_kg,
          fragile: item.fragile,
          rot_xy: item.rot_xy,
          posX: item.posX,
          posY: item.posY,
          posZ: item.posZ,
          rotation: item.rotation,
          objData: item.objData,
          mtlData: item.mtlData,
        })),
      },
    },
    include: {
      items: {
        orderBy: { order: 'asc' }
      },
      truck: true,
    },
  })

  return c.json({
    placement,
    unplacedItems: apiResponse.unplacedItems,
  }, 201)
})

// 配置削除
placementsRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await prisma.placement.delete({ where: { id } })
  return c.json({ success: true })
})

// モックアイテム生成
placementsRoutes.post('/mock/generate', async (c) => {
  const body = await c.req.json<{
    targetLoadRate?: number
    truckSize?: { width: number; depth: number; height: number }
    fragileRate?: number
    noRotateRate?: number
  }>()

  const result = generateMockItems({
    targetLoadRate: body.targetLoadRate ?? 0.8,
    truckSize: body.truckSize,
    fragileRate: body.fragileRate,
    noRotateRate: body.noRotateRate,
  })

  return c.json(result)
})

// 箱タイプ指定でモックアイテム生成
placementsRoutes.post('/mock/generate-by-count', async (c) => {
  const body = await c.req.json<{
    counts: Record<string, number>
    fragileRate?: number
    noRotateRate?: number
  }>()

  const result = generateItemsByCount(body.counts, {
    fragileRate: body.fragileRate,
    noRotateRate: body.noRotateRate,
  })

  return c.json(result)
})

// モックデータで配置計算（外部API呼び出し）
placementsRoutes.post('/mock/calculate', async (c) => {
  const body = await c.req.json<{
    truckId: string
    targetLoadRate?: number
    externalApiUrl?: string
  }>()

  const { truckId, targetLoadRate = 0.8, externalApiUrl } = body
  const apiUrl = externalApiUrl || EXTERNAL_API_URL

  // 荷台を取得
  const truck = await prisma.truck.findUnique({ where: { id: truckId } })
  if (!truck) {
    return c.json({ error: 'Truck not found' }, 404)
  }

  // 荷台サイズを取得（DBはメートル単位なのでmmに変換）
  const truckSize = {
    width: ((truck.maxX ?? 1.7) - (truck.minX ?? 0)) * 1000,
    depth: ((truck.maxY ?? 3.1) - (truck.minY ?? 0)) * 1000,
    height: ((truck.maxZ ?? 1.8) - (truck.minZ ?? 0)) * 1000,
  }

  // モックアイテムを生成
  const { items } = generateMockItems({
    targetLoadRate,
    truckSize,
  })

  // 3Dファイルを読み込み
  let objData: string
  let mtlData: string | null = null

  try {
    objData = await readFile(truck.objFilePath, 'utf-8')
    if (truck.mtlFilePath) {
      mtlData = await readFile(truck.mtlFilePath, 'utf-8')
    }
  } catch {
    return c.json({ error: 'Failed to read 3D files' }, 500)
  }

  // リクエストデータを準備
  const requestData = {
    truck: {
      objData,
      mtlData,
      entranceDirection: truck.entranceDirection,
      bounds: {
        minX: truck.minX ?? 0,
        minY: truck.minY ?? 0,
        minZ: truck.minZ ?? 0,
        maxX: truck.maxX ?? truckSize.width,
        maxY: truck.maxY ?? truckSize.depth,
        maxZ: truck.maxZ ?? truckSize.height,
      },
    },
    items,
  }

  // リクエストデータをローカルに保存（本番環境以外）
  let logFilePath: string | null = null
  if (process.env.NODE_ENV !== 'production') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const logFileName = `request_${timestamp}.json`
    logFilePath = path.join(REQUEST_LOG_DIR, logFileName)

    try {
      if (!existsSync(REQUEST_LOG_DIR)) {
        await mkdir(REQUEST_LOG_DIR, { recursive: true })
      }
      await writeFile(logFilePath, JSON.stringify(requestData, null, 2), 'utf-8')
      console.log(`Request data saved to: ${logFilePath}`)
    } catch (err) {
      console.error('Failed to save request data:', err)
      logFilePath = null
    }
  }

  console.log(`Sending ${items.length} mock items to ${apiUrl}/calculate`)

  // 外部APIにリクエスト
  let apiResponse: ExternalApiResponse

  try {
    const response = await fetch(`${apiUrl}/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('External API error:', response.status, errorText)
      throw new Error(`External API returned ${response.status}: ${errorText}`)
    }

    apiResponse = await response.json()
  } catch (error) {
    console.error('External API error:', error)
    // 外部APIが利用不可の場合はフォールバック
    apiResponse = fallbackPlacement(items, truck)
  }

  // 配置結果をDBに保存
  const placement = await prisma.placement.create({
    data: {
      truckId,
      resultData: {
        ...apiResponse,
        mockGenerated: true,
        targetLoadRate,
      } as JsonValue,
      items: {
        create: apiResponse.placedItems.map((item) => ({
          itemId: item.id,
          x_mm: item.x_mm,
          y_mm: item.y_mm,
          z_mm: item.z_mm,
          order: item.order,
          weight_kg: item.weight_kg,
          fragile: item.fragile,
          rot_xy: item.rot_xy,
          posX: item.posX,
          posY: item.posY,
          posZ: item.posZ,
          rotation: item.rotation,
          objData: item.objData,
          mtlData: item.mtlData,
        })),
      },
    },
    include: {
      items: {
        orderBy: { order: 'asc' }
      },
      truck: true,
    },
  })

  return c.json({
    placement,
    generatedItems: items.length,
    placedItems: apiResponse.placedItems.length,
    unplacedItems: apiResponse.unplacedItems,
    ...(logFilePath && { requestLogFile: logFilePath }),
  }, 201)
})

// フォールバック配置アルゴリズム（外部APIが利用不可の場合）
function fallbackPlacement(
  items: InputItem[],
  truck: { minX: number | null; minY: number | null; minZ: number | null; maxX: number | null; maxY: number | null; maxZ: number | null }
): ExternalApiResponse {
  const minX = truck.minX ?? 0
  const minY = truck.minY ?? 0
  const minZ = truck.minZ ?? 0
  const maxX = truck.maxX ?? 3000
  const maxY = truck.maxY ?? 2000
  const maxZ = truck.maxZ ?? 2000

  const truckWidth = maxX - minX
  const truckDepth = maxY - minY
  const truckHeight = maxZ - minZ

  // 重量順にソート（重いものを先に）
  const sortedItems = [...items].sort((a, b) => {
    if (a.fragile !== b.fragile) {
      return a.fragile ? 1 : -1 // 壊れ物は後
    }
    return b.weight_kg - a.weight_kg // 重いものが先
  })

  const placedItems: PlacedItemResult[] = []
  const unplacedItems: InputItem[] = []

  // シンプルなグリッド配置
  let currentX = minX
  let currentY = minY
  let currentZ = minZ
  let rowMaxZ = 0
  let layerMaxY = 0

  for (const item of sortedItems) {
    // 幅がはみ出す場合は次の行へ
    if (currentX + item.x_mm > maxX) {
      currentX = minX
      currentZ += rowMaxZ
      rowMaxZ = 0
    }

    // 高さがはみ出す場合は次の層へ
    if (currentZ + item.z_mm > maxZ) {
      currentZ = minZ
      currentY += layerMaxY
      layerMaxY = 0
      rowMaxZ = 0
    }

    // 奥行きがはみ出す場合は配置不可
    if (currentY + item.y_mm > maxY) {
      unplacedItems.push(item)
      continue
    }

    placedItems.push({
      ...item,
      posX: currentX,
      posY: currentY,
      posZ: currentZ,
      rotation: 0,
    })

    currentX += item.x_mm
    rowMaxZ = Math.max(rowMaxZ, item.z_mm)
    layerMaxY = Math.max(layerMaxY, item.y_mm)
  }

  // orderで再ソート
  placedItems.sort((a, b) => a.order - b.order)

  return {
    success: true,
    placedItems,
    unplacedItems,
  }
}
