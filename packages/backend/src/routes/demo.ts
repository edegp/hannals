import { Hono } from 'hono'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { prisma } from '../lib/prisma'
export const demoRoutes = new Hono()

const DEMO_DIR = path.join(process.cwd(), '..', '..', 'docs', 'demo')

// デモ配置リスト取得
demoRoutes.get('/', (c) => {
  return c.json({
    demos: [
      { id: 'optimal', name: '最適配置', description: '隙間なく詰めた配置' },
      { id: 'random', name: 'ランダム配置', description: '適当に詰めた配置' },
    ]
  })
})

// デモ配置データ取得（CSV → JSON）
demoRoutes.get('/:type/items', (c) => {
  const type = c.req.param('type')
  if (type !== 'optimal' && type !== 'random') {
    return c.json({ error: 'Invalid demo type' }, 400)
  }

  const csvPath = path.join(DEMO_DIR, `placed_${type}.csv`)
  if (!existsSync(csvPath)) {
    return c.json({ error: 'Demo data not found. Run: make generate-demo' }, 404)
  }

  const csv = readFileSync(csvPath, 'utf-8')
  const lines = csv.trim().split('\n')
  const headers = lines[0].split(',')

  const items = lines.slice(1).map((line) => {
    const values = line.split(',')
    const item: Record<string, string | number | boolean> = {}
    headers.forEach((header, i) => {
      const value = values[i]
      if (['x_mm', 'y_mm', 'z_mm', 'order', 'rotation', 'loadOrder'].includes(header)) {
        item[header] = parseInt(value)
      } else if (['weight_kg', 'posX', 'posY', 'posZ'].includes(header)) {
        item[header] = parseFloat(value)
      } else if (['fragile', 'rot_xy'].includes(header)) {
        item[header] = value === 'true'
      } else if (['id', 'name', 'destination'].includes(header)) {
        item[header] = value
      } else {
        item[header] = value
      }
    })
    return item
  })

  return c.json({ items, count: items.length })
})

// デモデータをデータベースに保存
demoRoutes.post('/:type/load', async (c) => {
  const type = c.req.param('type')
  if (type !== 'optimal' && type !== 'random') {
    return c.json({ error: 'Invalid demo type' }, 400)
  }

  const body = await c.req.json()
  const { truckId } = body

  if (!truckId) {
    return c.json({ error: 'truckId is required' }, 400)
  }

  const csvPath = path.join(DEMO_DIR, `placed_${type}.csv`)
  if (!existsSync(csvPath)) {
    return c.json({ error: 'Demo data not found. Run: make generate-demo' }, 404)
  }

  const csv = readFileSync(csvPath, 'utf-8')
  const lines = csv.trim().split('\n')
  const headers = lines[0].split(',')

  const items = lines.slice(1).map((line) => {
    const values = line.split(',')
    const item: Record<string, string | number | boolean> = {}
    headers.forEach((header, i) => {
      const value = values[i]
      if (['x_mm', 'y_mm', 'z_mm', 'order', 'rotation', 'loadOrder'].includes(header)) {
        item[header] = parseInt(value)
      } else if (['weight_kg', 'posX', 'posY', 'posZ'].includes(header)) {
        item[header] = parseFloat(value)
      } else if (['fragile', 'rot_xy'].includes(header)) {
        item[header] = value === 'true'
      } else if (['id', 'name', 'destination'].includes(header)) {
        item[header] = value
      } else {
        item[header] = value
      }
    })
    return item
  })

  // データベースに保存
  const placement = await prisma.placement.create({
    data: {
      truckId,
      items: {
        create: items.map((item) => ({
          itemId: item.id as string,
          name: (item.name as string) || null,
          destination: (item.destination as string) || null,
          x_mm: item.x_mm as number,
          y_mm: item.y_mm as number,
          z_mm: item.z_mm as number,
          order: item.order as number,
          loadOrder: (item.loadOrder as number) || null,
          weight_kg: item.weight_kg as number,
          fragile: (item.fragile as boolean) || false,
          rot_xy: (item.rot_xy as boolean) || false,
          posX: item.posX as number,
          posY: item.posY as number,
          posZ: item.posZ as number,
          rotation: (item.rotation as number) || 0,
          isLoaded: false,
          isDelivered: false,
        })),
      },
    },
    include: {
      items: true,
    },
  })

  return c.json({
    placementId: placement.id,
    items: placement.items,
    count: placement.items.length
  })
})

// デモ配置OBJファイル取得
demoRoutes.get('/:type/obj', (c) => {
  const type = c.req.param('type')
  if (type !== 'optimal' && type !== 'random') {
    return c.json({ error: 'Invalid demo type' }, 400)
  }

  const objPath = path.join(DEMO_DIR, `placed_${type}.obj`)
  if (!existsSync(objPath)) {
    return c.json({ error: 'Demo OBJ not found. Run: make generate-demo' }, 404)
  }

  const obj = readFileSync(objPath, 'utf-8')
  return new Response(obj, {
    headers: { 'Content-Type': 'text/plain' }
  })
})

// 入力アイテムCSV取得
demoRoutes.get('/items/csv', (c) => {
  const csvPath = path.join(DEMO_DIR, 'items_80percent.csv')
  if (!existsSync(csvPath)) {
    return c.json({ error: 'Demo data not found. Run: make generate-demo' }, 404)
  }

  const csv = readFileSync(csvPath, 'utf-8')
  return new Response(csv, {
    headers: { 'Content-Type': 'text/csv' }
  })
})
