import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from '@hono/node-server/serve-static'
import { trucksRoutes } from './routes/trucks'
import { placementsRoutes } from './routes/placements'
import { dimensionsRoutes } from './routes/dimensions'
import { demoRoutes } from './routes/demo'

const app = new Hono()

// CORS設定
app.use('/*', cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type'],
}))

// 静的ファイル配信（アップロードされた3Dファイル）
app.use('/uploads/*', serveStatic({ root: './' }))

// ヘルスチェック
app.get('/', (c) => c.json({ status: 'ok', message: 'Hannals API' }))

// ルート
app.route('/api/trucks', trucksRoutes)
app.route('/api/placements', placementsRoutes)
app.route('/api/dimensions', dimensionsRoutes)
app.route('/api/demo', demoRoutes)

const port = Number(process.env.PORT) || 8080
console.log(`Server is running on http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port,
})
