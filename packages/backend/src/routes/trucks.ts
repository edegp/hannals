import { Hono } from 'hono'
import { prisma } from '../lib/prisma'
import { writeFile, mkdir, readFile, unlink } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export const trucksRoutes = new Hono()

const UPLOADS_DIR = join(process.cwd(), 'uploads')

// uploadsディレクトリの作成
async function ensureUploadsDir() {
  if (!existsSync(UPLOADS_DIR)) {
    await mkdir(UPLOADS_DIR, { recursive: true })
  }
}

// 荷台一覧取得
trucksRoutes.get('/', async (c) => {
  const trucks = await prisma.truck.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { placements: true }
      }
    }
  })
  return c.json(trucks)
})

// 荷台詳細取得
trucksRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  const truck = await prisma.truck.findUnique({
    where: { id },
    include: { placements: true }
  })
  if (!truck) {
    return c.json({ error: 'Not found' }, 404)
  }
  return c.json(truck)
})

// 3Dファイル取得
trucksRoutes.get('/:id/obj', async (c) => {
  const id = c.req.param('id')
  const truck = await prisma.truck.findUnique({ where: { id } })
  if (!truck) {
    return c.json({ error: 'Not found' }, 404)
  }

  try {
    const objData = await readFile(truck.objFilePath, 'utf-8')
    return c.text(objData, 200, {
      'Content-Type': 'text/plain',
    })
  } catch {
    return c.json({ error: 'OBJ file not found' }, 404)
  }
})

trucksRoutes.get('/:id/mtl', async (c) => {
  const id = c.req.param('id')
  const truck = await prisma.truck.findUnique({ where: { id } })
  if (!truck || !truck.mtlFilePath) {
    return c.json({ error: 'Not found' }, 404)
  }

  try {
    const mtlData = await readFile(truck.mtlFilePath, 'utf-8')
    return c.text(mtlData, 200, {
      'Content-Type': 'text/plain',
    })
  } catch {
    return c.json({ error: 'MTL file not found' }, 404)
  }
})

// 荷台登録（3Dファイルアップロード）
trucksRoutes.post('/', async (c) => {
  await ensureUploadsDir()

  const formData = await c.req.formData()
  const name = formData.get('name') as string
  const entranceDirection = (formData.get('entranceDirection') as string) || 'back'
  const objFile = formData.get('objFile') as File | null
  const mtlFile = formData.get('mtlFile') as File | null

  if (!name || !objFile) {
    return c.json({ error: 'name and objFile are required' }, 400)
  }

  // タイムスタンプでユニークなファイル名を生成
  const timestamp = Date.now()
  const objFileName = `${timestamp}_${objFile.name}`
  const objFilePath = join(UPLOADS_DIR, objFileName)

  // OBJファイルを保存
  const objBuffer = await objFile.arrayBuffer()
  await writeFile(objFilePath, Buffer.from(objBuffer))

  // MTLファイルを保存（あれば）
  let mtlFilePath: string | null = null
  if (mtlFile) {
    const mtlFileName = `${timestamp}_${mtlFile.name}`
    mtlFilePath = join(UPLOADS_DIR, mtlFileName)
    const mtlBuffer = await mtlFile.arrayBuffer()
    await writeFile(mtlFilePath, Buffer.from(mtlBuffer))
  }

  // バウンディングボックスをOBJファイルから計算
  const objContent = await readFile(objFilePath, 'utf-8')
  const bounds = calculateBoundingBox(objContent)

  const truck = await prisma.truck.create({
    data: {
      name,
      objFilePath,
      mtlFilePath,
      entranceDirection,
      minX: bounds.minX,
      minY: bounds.minY,
      minZ: bounds.minZ,
      maxX: bounds.maxX,
      maxY: bounds.maxY,
      maxZ: bounds.maxZ,
    }
  })

  return c.json(truck, 201)
})

// 荷台更新（入り口方向など）
trucksRoutes.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<{
    name?: string
    entranceDirection?: string
  }>()

  const truck = await prisma.truck.update({
    where: { id },
    data: body,
  })

  return c.json(truck)
})

// 荷台削除
trucksRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')

  // ファイルも削除
  const truck = await prisma.truck.findUnique({ where: { id } })
  if (truck) {
    try {
      await unlink(truck.objFilePath)
      if (truck.mtlFilePath) {
        await unlink(truck.mtlFilePath)
      }
    } catch {
      // ファイルが存在しない場合は無視
    }
  }

  await prisma.truck.delete({ where: { id } })
  return c.json({ success: true })
})

// OBJファイルからバウンディングボックスを計算
function calculateBoundingBox(objContent: string): {
  minX: number
  minY: number
  minZ: number
  maxX: number
  maxY: number
  maxZ: number
} {
  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity

  const lines = objContent.split('\n')
  for (const line of lines) {
    if (line.startsWith('v ')) {
      const parts = line.trim().split(/\s+/)
      const x = parseFloat(parts[1])
      const y = parseFloat(parts[2])
      const z = parseFloat(parts[3])

      if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        minZ = Math.min(minZ, z)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
        maxZ = Math.max(maxZ, z)
      }
    }
  }

  // 頂点がない場合のデフォルト値
  if (minX === Infinity) {
    return { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 }
  }

  return { minX, minY, minZ, maxX, maxY, maxZ }
}
