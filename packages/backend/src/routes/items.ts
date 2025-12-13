import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const itemsRoutes = new Hono()

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
    return c.json({ error: 'Item not found' }, 404)
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
    return c.json({ error: 'Item not found' }, 404)
  }
})

// 配送済みにする
itemsRoutes.patch('/:id/deliver', async (c) => {
  const id = c.req.param('id')

  try {
    const item = await prisma.placedItem.update({
      where: { id },
      data: {
        isDelivered: true,
        deliveredAt: new Date(),
      },
    })
    return c.json(item)
  } catch (error) {
    return c.json({ error: 'Item not found' }, 404)
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
    return c.json({ error: 'Item not found' }, 404)
  }
})
