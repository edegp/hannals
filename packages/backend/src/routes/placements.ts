import { Hono } from 'hono'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonValue = any
import { prisma } from '../lib/prisma'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import AdmZip from 'adm-zip'
import { generateMockItems, generateItemsByCount, type GeneratedItem } from '../lib/mockItemGenerator'

// リクエストログの保存先
const REQUEST_LOG_DIR = path.join(process.cwd(), 'logs', 'requests')
// レスポンスZIPの保存先
const RESPONSE_DIR = path.join(process.cwd(), 'logs', 'responses')
// サンプルファイルの保存先
const SAMPLE_DIR = path.join(process.cwd(), '..', '..', 'sample')

export const placementsRoutes = new Hono()

// 外部APIのURL（環境変数から取得）
const EXTERNAL_API_URL = process.env.EXTERNAL_API_URL || 'http://localhost:5000'
// モックモード（環境変数 EXTERNAL_API_MOCK=true で有効）
const USE_MOCK_API = process.env.EXTERNAL_API_MOCK === 'true'

// モック: サンプルのvoxels_result.zipを読み込み
async function mockUploadTrunk(): Promise<ArrayBuffer> {
  const zipPath = path.join(SAMPLE_DIR, 'voxels_result.zip')
  const data = await readFile(zipPath)
  console.log(`[Mock] Read voxels_result.zip (${data.length} bytes)`)
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
}

// モック: サンプルのbaggage_result.zipを読み込み
async function mockUploadPacklist(): Promise<ArrayBuffer> {
  const zipPath = path.join(SAMPLE_DIR, 'baggage_result.zip')
  const data = await readFile(zipPath)
  console.log(`[Mock] Read baggage_result.zip (${data.length} bytes)`)
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
}

// 外部API: OBJファイルをアップロード → voxels_result.zip
async function uploadTrunk(apiUrl: string, objFilePath: string): Promise<ArrayBuffer> {
  const objData = await readFile(objFilePath)
  const formData = new FormData()
  formData.append('file', new Blob([objData]), path.basename(objFilePath))

  const response = await fetch(`${apiUrl}/upload/trunk`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`upload/trunk failed: ${response.status} ${errorText}`)
  }

  return response.arrayBuffer()
}

// 外部API: JSONファイルをアップロード → baggage_result.zip
async function uploadPacklist(apiUrl: string, packlistData: object): Promise<ArrayBuffer> {
  const jsonStr = JSON.stringify(packlistData, null, 2)
  const formData = new FormData()
  formData.append('file', new Blob([jsonStr], { type: 'application/json' }), 'packlist.json')

  const response = await fetch(`${apiUrl}/upload/packlist`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`upload/packlist failed: ${response.status} ${errorText}`)
  }

  return response.arrayBuffer()
}

// ZIPファイルを保存
async function saveZipFile(zipData: ArrayBuffer, filename: string): Promise<string> {
  if (!existsSync(RESPONSE_DIR)) {
    await mkdir(RESPONSE_DIR, { recursive: true })
  }
  const filePath = path.join(RESPONSE_DIR, filename)
  await writeFile(filePath, Buffer.from(zipData))
  return filePath
}

// baggage_result.zipからアイテムのOBJ/MTLを抽出
interface ExtractedItemObj {
  order: number
  objData: string
  mtlData: string | null
}

function extractBaggageItems(zipData: ArrayBuffer): ExtractedItemObj[] {
  const zip = new AdmZip(Buffer.from(zipData))
  const entries = zip.getEntries()

  // ファイル名パターン: trunkVoxel_timestamp_orderNumber.obj/mtl
  // 例: trunkVoxel_2512140653_001.obj → order = 1
  const orderPattern = /_(\d+)\.(obj|mtl)$/i

  // orderごとにOBJ/MTLをグループ化
  const itemMap = new Map<number, { objData?: string; mtlData?: string }>()

  for (const entry of entries) {
    const match = entry.entryName.match(orderPattern)
    if (!match) continue

    const order = parseInt(match[1], 10)
    const ext = match[2].toLowerCase()
    const content = entry.getData().toString('utf-8')

    if (!itemMap.has(order)) {
      itemMap.set(order, {})
    }

    const item = itemMap.get(order)!
    if (ext === 'obj') {
      item.objData = content
    } else if (ext === 'mtl') {
      item.mtlData = content
    }
  }

  // 配列に変換してorder順にソート
  const result: ExtractedItemObj[] = []
  for (const [order, data] of itemMap) {
    if (data.objData) {
      result.push({
        order,
        objData: data.objData,
        mtlData: data.mtlData ?? null,
      })
    }
  }

  return result.sort((a, b) => a.order - b.order)
}

// voxels_result.zipからボクセル化されたトラックのOBJ/MTLを抽出
interface ExtractedVoxelTruck {
  objData: string
  mtlData: string | null
}

function extractVoxelTruck(zipData: ArrayBuffer): ExtractedVoxelTruck | null {
  const zip = new AdmZip(Buffer.from(zipData))
  const entries = zip.getEntries()

  let objData: string | undefined
  let mtlData: string | null = null

  for (const entry of entries) {
    const name = entry.entryName.toLowerCase()
    if (name.endsWith('.obj')) {
      objData = entry.getData().toString('utf-8')
    } else if (name.endsWith('.mtl')) {
      mtlData = entry.getData().toString('utf-8')
    }
  }

  if (!objData) return null

  return { objData, mtlData }
}

// OBJファイルから頂点座標の境界ボックスを抽出（位置情報として使用）
interface ObjBoundingBox {
  minX: number
  minY: number
  minZ: number
  maxX: number
  maxY: number
  maxZ: number
}

function parseObjBoundingBox(objData: string): ObjBoundingBox | null {
  const lines = objData.split('\n')
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  let hasVertices = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('v ')) continue

    const parts = trimmed.split(/\s+/)
    if (parts.length < 4) continue

    const x = parseFloat(parts[1])
    const y = parseFloat(parts[2])
    const z = parseFloat(parts[3])

    if (isNaN(x) || isNaN(y) || isNaN(z)) continue

    hasVertices = true
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    minZ = Math.min(minZ, z)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
    maxZ = Math.max(maxZ, z)
  }

  if (!hasVertices) return null

  return { minX, minY, minZ, maxX, maxY, maxZ }
}

interface InputItem {
  id: string
  name?: string
  destination?: string
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
  name?: string
  destination?: string
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

// ボクセル化されたトラックのOBJデータを取得
placementsRoutes.get('/:id/voxel/obj', async (c) => {
  const id = c.req.param('id')

  const placement = await prisma.placement.findUnique({
    where: { id },
    select: { voxelObjData: true },
  })

  if (!placement) {
    return c.json({ error: 'Placement not found' }, 404)
  }

  if (!placement.voxelObjData) {
    return c.json({ error: 'Voxel OBJ data not available' }, 404)
  }

  return new Response(placement.voxelObjData, {
    headers: {
      'Content-Type': 'text/plain',
      'Content-Disposition': `inline; filename="${id}_voxel.obj"`,
    },
  })
})

// ボクセル化されたトラックのMTLデータを取得
placementsRoutes.get('/:id/voxel/mtl', async (c) => {
  const id = c.req.param('id')

  const placement = await prisma.placement.findUnique({
    where: { id },
    select: { voxelMtlData: true },
  })

  if (!placement) {
    return c.json({ error: 'Placement not found' }, 404)
  }

  if (!placement.voxelMtlData) {
    return c.json({ error: 'Voxel MTL data not available' }, 404)
  }

  return new Response(placement.voxelMtlData, {
    headers: {
      'Content-Type': 'text/plain',
      'Content-Disposition': `inline; filename="${id}_voxel.mtl"`,
    },
  })
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

// モックデータで配置計算（外部API呼び出し - 旧形式）
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

// 新形式: upload/trunk + upload/packlist を使った配置計算
// items が渡されれば使用、なければモックアイテムを生成
placementsRoutes.post('/calculate-v2', async (c) => {
  const body = await c.req.json<{
    truckId: string
    items?: InputItem[]
    targetLoadRate?: number
    externalApiUrl?: string
    useMock?: boolean
  }>()

  const { truckId, items: inputItems, targetLoadRate = 0.8, externalApiUrl, useMock } = body
  const apiUrl = externalApiUrl || EXTERNAL_API_URL
  const shouldUseMock = useMock ?? USE_MOCK_API

  // 荷台を取得
  const truck = await prisma.truck.findUnique({ where: { id: truckId } })
  if (!truck) {
    return c.json({ error: 'Truck not found' }, 404)
  }

  // 荷台サイズを取得
  const truckSize = {
    width: ((truck.maxX ?? 1.7) - (truck.minX ?? 0)) * 1000,
    depth: ((truck.maxY ?? 3.1) - (truck.minY ?? 0)) * 1000,
    height: ((truck.maxZ ?? 1.8) - (truck.minZ ?? 0)) * 1000,
  }

  // itemsが渡されていればそれを使用、なければモック生成
  const items = inputItems && inputItems.length > 0
    ? inputItems
    : generateMockItems({ targetLoadRate, truckSize }).items
  const isMockGenerated = !inputItems || inputItems.length === 0

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

  // パックリストデータを準備
  const packlistData = {
    items: items.map(item => ({
      id: item.id,
      x_mm: item.x_mm,
      y_mm: item.y_mm,
      z_mm: item.z_mm,
      order: item.order,
      weight_kg: item.weight_kg,
      fragile: item.fragile,
      rot_xy: item.rot_xy,
    })),
    truck: {
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
  }

  // リクエストデータをローカルに保存
  let logFilePath: string | null = null
  if (process.env.NODE_ENV !== 'production') {
    const logFileName = `request_${timestamp}.json`
    logFilePath = path.join(REQUEST_LOG_DIR, logFileName)

    try {
      if (!existsSync(REQUEST_LOG_DIR)) {
        await mkdir(REQUEST_LOG_DIR, { recursive: true })
      }
      await writeFile(logFilePath, JSON.stringify(packlistData, null, 2), 'utf-8')
      console.log(`Request data saved to: ${logFilePath}`)
    } catch (err) {
      console.error('Failed to save request data:', err)
      logFilePath = null
    }
  }

  try {
    let voxelsZip: ArrayBuffer
    let baggageZip: ArrayBuffer

    if (shouldUseMock) {
      console.log('[Mock] Using sample ZIP files')
      voxelsZip = await mockUploadTrunk()
      baggageZip = await mockUploadPacklist()
    } else {
      console.log(`Uploading trunk OBJ to ${apiUrl}/upload/trunk`)
      voxelsZip = await uploadTrunk(apiUrl, truck.objFilePath)

      console.log(`Uploading packlist to ${apiUrl}/upload/packlist`)
      baggageZip = await uploadPacklist(apiUrl, packlistData)
    }

    const voxelsZipPath = await saveZipFile(voxelsZip, `voxels_result_${timestamp}.zip`)
    console.log(`Voxels result saved to: ${voxelsZipPath}`)

    // ボクセル化されたトラックを抽出
    const voxelTruck = extractVoxelTruck(voxelsZip)

    const baggageZipPath = await saveZipFile(baggageZip, `baggage_result_${timestamp}.zip`)
    console.log(`Baggage result saved to: ${baggageZipPath}`)

    // アイテムのOBJ/MTLを抽出
    const extractedItems = extractBaggageItems(baggageZip)
    console.log(`Extracted ${extractedItems.length} items from baggage_result.zip`)

    // orderをキーにしたマップを作成
    const extractedMap = new Map(extractedItems.map(e => [e.order, e]))

    // 配置結果を作成（アイテムのorderでマッチング）
    const placedItems: PlacedItemResult[] = []
    for (const item of items) {
      const extracted = extractedMap.get(item.order)
      if (!extracted) {
        console.warn(`No extracted OBJ for order ${item.order}`)
        continue
      }

      // OBJの境界ボックスから位置を取得
      const bbox = parseObjBoundingBox(extracted.objData)
      const posX = bbox ? bbox.minX : 0
      const posY = bbox ? bbox.minY : 0
      const posZ = bbox ? bbox.minZ : 0

      placedItems.push({
        ...item,
        posX,
        posY,
        posZ,
        rotation: 0,
        objData: extracted.objData,
        mtlData: extracted.mtlData,
      })
    }

    // 配置結果をDBに保存
    const placement = await prisma.placement.create({
      data: {
        truckId,
        resultData: {
          mockGenerated: isMockGenerated,
          targetLoadRate,
          voxelTruckObjPath: voxelsZipPath,
          baggageObjPath: baggageZipPath,
        } as JsonValue,
        voxelObjData: voxelTruck?.objData ?? null,
        voxelMtlData: voxelTruck?.mtlData ?? null,
        items: {
          create: placedItems.map((item) => ({
            itemId: item.id,
            name: item.name,
            destination: item.destination,
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
        items: { orderBy: { order: 'asc' } },
        truck: true,
      },
    })

    return c.json({
      placement,
      generatedItems: items.length,
      placedItems: placedItems.length,
      unplacedItems: items.length - placedItems.length,
      voxelsResultPath: voxelsZipPath,
      baggageResultPath: baggageZipPath,
      requestLogFile: logFilePath,
    }, 201)

  } catch (error) {
    console.error('External API error:', error)

    // フォールバック
    const apiResponse = fallbackPlacement(items, truck)

    const placement = await prisma.placement.create({
      data: {
        truckId,
        resultData: {
          ...apiResponse,
          mockGenerated: isMockGenerated,
          targetLoadRate,
          fallback: true,
        } as JsonValue,
        items: {
          create: apiResponse.placedItems.map((item) => ({
            itemId: item.id,
            name: item.name,
            destination: item.destination,
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
          })),
        },
      },
      include: {
        items: { orderBy: { order: 'asc' } },
        truck: true,
      },
    })

    return c.json({
      placement,
      generatedItems: items.length,
      placedItems: apiResponse.placedItems.length,
      unplacedItems: apiResponse.unplacedItems,
      fallback: true,
      error: String(error),
      requestLogFile: logFilePath,
    }, 201)
  }
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
