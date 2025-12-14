import { Hono } from 'hono'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'

export const itemsRoutes = new Hono()

// まとめて積み込み済みにする（デモ用途）
itemsRoutes.patch('/load', async (c) => {
  const body = await c.req.json().catch(() => null)
  const itemIds = body?.itemIds

  if (!Array.isArray(itemIds) || itemIds.length === 0 || itemIds.some((id) => typeof id !== 'string')) {
    return c.json({ error: 'itemIds is required' }, 400)
  }

  try {
    const result = await prisma.placedItem.updateMany({
      where: { id: { in: itemIds } },
      data: { isLoaded: true, loadedAt: new Date() },
    })
    return c.json({ updatedCount: result.count })
  } catch (error) {
    return c.json({ error: 'Failed to update items' }, 500)
  }
})

// 積み込み済みにする
itemsRoutes.patch('/:id/load', async (c) => {
  const id = c.req.param('id')

  try {
    const item = await prisma.placedItem.update({
      where: { id },
      data: {
        isLoaded: true,
        loadedAt: new Date(),
      },
    })
    return c.json(item)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return c.json({ error: 'Item not found' }, 404)
    }
    return c.json({ error: 'Failed to update item' }, 500)
  }
})

// 積み込み済みを取り消す
itemsRoutes.patch('/:id/unload', async (c) => {
  const id = c.req.param('id')

  try {
    const item = await prisma.placedItem.update({
      where: { id },
      data: {
        isLoaded: false,
        loadedAt: null,
      },
    })
    return c.json(item)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return c.json({ error: 'Item not found' }, 404)
    }
    return c.json({ error: 'Failed to update item' }, 500)
  }
})

// 配送済みにする
itemsRoutes.patch('/:id/deliver', async (c) => {
  const id = c.req.param('id')

  const current = await prisma.placedItem.findUnique({
    where: { id },
    select: { isLoaded: true },
  })

  if (!current) {
    return c.json({ error: 'Item not found' }, 404)
  }

  if (!current.isLoaded) {
    return c.json({ error: 'Item must be loaded before delivery' }, 400)
  }

  try {
    const existing = await prisma.placedItem.findUnique({
      where: { id },
      select: { isLoaded: true },
    })
    if (!existing) {
      return c.json({ error: 'Item not found' }, 404)
    }
    if (!existing.isLoaded) {
      return c.json({ error: 'Item must be loaded before delivery' }, 400)
    }

    const item = await prisma.placedItem.update({
      where: { id },
      data: {
        isDelivered: true,
        deliveredAt: new Date(),
      },
    })
    return c.json(item)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return c.json({ error: 'Item not found' }, 404)
    }
    return c.json({ error: 'Failed to update item' }, 500)
  }
})

// 配送済みを取り消す
itemsRoutes.patch('/:id/undeliver', async (c) => {
  const id = c.req.param('id')

  try {
    const item = await prisma.placedItem.update({
      where: { id },
      data: {
        isDelivered: false,
        deliveredAt: null,
      },
    })
    return c.json(item)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return c.json({ error: 'Item not found' }, 404)
    }
    return c.json({ error: 'Failed to update item' }, 500)
  }
})

// アイテムのOBJデータを取得
itemsRoutes.get('/:id/obj', async (c) => {
  const id = c.req.param('id')

  const item = await prisma.placedItem.findUnique({
    where: { id },
    select: { objData: true },
  })

  if (!item) {
    return c.json({ error: 'Item not found' }, 404)
  }

  if (!item.objData) {
    return c.json({ error: 'OBJ data not available' }, 404)
  }

  return new Response(item.objData, {
    headers: {
      'Content-Type': 'text/plain',
      'Content-Disposition': `inline; filename="${id}.obj"`,
    },
  })
})

// アイテムのMTLデータを取得
itemsRoutes.get('/:id/mtl', async (c) => {
  const id = c.req.param('id')

  const item = await prisma.placedItem.findUnique({
    where: { id },
    select: { mtlData: true },
  })

  if (!item) {
    return c.json({ error: 'Item not found' }, 404)
  }

  if (!item.mtlData) {
    return c.json({ error: 'MTL data not available' }, 404)
  }

  return new Response(item.mtlData, {
    headers: {
      'Content-Type': 'text/plain',
      'Content-Disposition': `inline; filename="${id}.mtl"`,
    },
  })
})
