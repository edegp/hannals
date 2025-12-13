import { Hono } from 'hono'
import { generateMultiBoxObj, BoxDimensions } from '../lib/objGenerator'

export const dimensionsRoutes = new Hono()

// さくらのAI Engine API設定
const SAKURA_API_URL = 'https://api.ai.sakura.ad.jp/v1/chat/completions'
const SAKURA_API_KEY = process.env.SAKURA_API_KEY || ''
const VISION_MODEL = process.env.VISION_MODEL || 'preview/Qwen3-VL-30B-A3B-Instruct'

interface DimensionResult {
  success: boolean
  items: {
    id: string
    name?: string
    x_mm: number
    y_mm: number
    z_mm: number
    weight_kg?: number
    fragile?: boolean
  }[]
  rawResponse?: string
  error?: string
}

// 寸法抽出用のシステムプロンプト
const SYSTEM_PROMPT = `あなたは荷物の寸法を計測する専門家です。
画像に写っている荷物や箱の寸法を分析し、以下のJSON形式で出力してください。

出力形式:
{
  "items": [
    {
      "id": "item_1",
      "name": "荷物の説明",
      "x_mm": 幅（mm）,
      "y_mm": 奥行き（mm）,
      "z_mm": 高さ（mm）,
      "weight_kg": 推定重量（kg、不明な場合はnull）,
      "fragile": 壊れやすいかどうか（true/false）
    }
  ]
}

注意事項:
- 寸法は必ずミリメートル単位で出力してください
- 画像内に複数の荷物がある場合は、それぞれを別のアイテムとして出力してください
- 寸法が推定できない場合は、一般的なサイズを推定してください
- 出力はJSONのみで、説明文は不要です`

// 画像から寸法を抽出
dimensionsRoutes.post('/extract', async (c) => {
  if (!SAKURA_API_KEY) {
    return c.json({
      success: false,
      error: 'SAKURA_API_KEY is not configured',
      items: []
    } satisfies DimensionResult, 500)
  }

  const formData = await c.req.formData()
  const imageFile = formData.get('image') as File | null
  const imageUrl = formData.get('imageUrl') as string | null
  const additionalPrompt = formData.get('prompt') as string | null

  if (!imageFile && !imageUrl) {
    return c.json({
      success: false,
      error: 'image or imageUrl is required',
      items: []
    } satisfies DimensionResult, 400)
  }

  let imageContent: { type: 'image_url'; image_url: { url: string } }

  if (imageFile) {
    // ファイルをbase64に変換
    const arrayBuffer = await imageFile.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = imageFile.type || 'image/jpeg'
    imageContent = {
      type: 'image_url',
      image_url: {
        url: `data:${mimeType};base64,${base64}`
      }
    }
  } else {
    // URLをそのまま使用
    imageContent = {
      type: 'image_url',
      image_url: {
        url: imageUrl!
      }
    }
  }

  const userPrompt = additionalPrompt
    ? `この画像から荷物の寸法を抽出してください。追加情報: ${additionalPrompt}`
    : 'この画像から荷物の寸法を抽出してください。'

  try {
    const response = await fetch(SAKURA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SAKURA_API_KEY}`,
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              imageContent,
            ],
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Sakura API error:', errorText)
      return c.json({
        success: false,
        error: `Sakura API error: ${response.status}`,
        items: []
      } satisfies DimensionResult, 500)
    }

    const data = await response.json() as {
      choices: { message: { content: string } }[]
    }
    const content = data.choices[0]?.message?.content || ''

    // JSONを抽出（コードブロック内の場合も考慮）
    let jsonStr = content
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    }

    // JSON内の{...}を抽出
    const jsonObjectMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (jsonObjectMatch) {
      jsonStr = jsonObjectMatch[0]
    }

    try {
      const parsed = JSON.parse(jsonStr) as { items: DimensionResult['items'] }

      // IDが無い場合は自動生成
      const items = parsed.items.map((item, index) => ({
        ...item,
        id: item.id || `item_${index + 1}`,
        x_mm: Math.round(item.x_mm),
        y_mm: Math.round(item.y_mm),
        z_mm: Math.round(item.z_mm),
      }))

      return c.json({
        success: true,
        items,
        rawResponse: content,
      } satisfies DimensionResult)
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Content:', content)
      return c.json({
        success: false,
        error: 'Failed to parse AI response as JSON',
        items: [],
        rawResponse: content,
      } satisfies DimensionResult, 500)
    }
  } catch (error) {
    console.error('Dimension extraction error:', error)
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      items: [],
    } satisfies DimensionResult, 500)
  }
})

// 利用可能なモデル情報を取得
dimensionsRoutes.get('/models', async (c) => {
  return c.json({
    currentModel: VISION_MODEL,
    availableModels: [
      'preview/Qwen3-VL-30B-A3B-Instruct',
      'preview/Phi-4-multimodal-instruct',
    ],
    apiConfigured: !!SAKURA_API_KEY,
  })
})

// 寸法からOBJファイルを生成
dimensionsRoutes.post('/generate-obj', async (c) => {
  const body = await c.req.json<{
    items: Array<{
      id: string
      name?: string
      x_mm: number
      y_mm: number
      z_mm: number
      posX?: number
      posY?: number
      posZ?: number
      rotation?: number
    }>
  }>()

  if (!body.items || body.items.length === 0) {
    return c.json({ error: 'items array is required' }, 400)
  }

  const boxes: BoxDimensions[] = body.items.map((item, index) => ({
    id: item.id || `item_${index + 1}`,
    name: item.name,
    x_mm: item.x_mm,
    y_mm: item.y_mm,
    z_mm: item.z_mm,
    posX: item.posX || 0,
    posY: item.posY || 0,
    posZ: item.posZ || 0,
    rotation: item.rotation || 0,
  }))

  const objContent = generateMultiBoxObj(boxes)

  return c.text(objContent, 200, {
    'Content-Type': 'text/plain',
    'Content-Disposition': 'attachment; filename="items.obj"',
  })
})
