import { Hono } from 'hono'
import { prisma } from '../lib/prisma'

export const cargoAreaRoutes = new Hono()

// 積載領域一覧取得
cargoAreaRoutes.get('/', async (c) => {
  const areas = await prisma.cargoArea.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { items: true }
      }
    }
  })
  return c.json(areas)
})

// 積載領域詳細取得
cargoAreaRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  const area = await prisma.cargoArea.findUnique({
    where: { id },
    include: { items: true }
  })
  if (!area) {
    return c.json({ error: 'Not found' }, 404)
  }
  return c.json(area)
})

// 積載領域作成
cargoAreaRoutes.post('/', async (c) => {
  const body = await c.req.json<{
    name: string
    minX: number
    minY: number
    minZ: number
    maxX: number
    maxY: number
    maxZ: number
  }>()

  const area = await prisma.cargoArea.create({
    data: {
      name: body.name,
      minX: body.minX,
      minY: body.minY,
      minZ: body.minZ,
      maxX: body.maxX,
      maxY: body.maxY,
      maxZ: body.maxZ,
    }
  })

  return c.json(area, 201)
})

// 積載領域削除
cargoAreaRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await prisma.cargoArea.delete({ where: { id } })
  return c.json({ success: true })
})
