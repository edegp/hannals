'use client'

import { useState, useRef } from 'react'
import { Truck } from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

interface TruckUploaderProps {
  onUpload: (truck: Truck) => void
  onCancel: () => void
}

type UploadMode = 'file' | 'photo'

interface ExtractedDimensions {
  width_mm: number
  depth_mm: number
  height_mm: number
}

export function TruckUploader({ onUpload, onCancel }: TruckUploaderProps) {
  const [mode, setMode] = useState<UploadMode>('photo')
  const [name, setName] = useState('')
  const [entranceDirection, setEntranceDirection] = useState<'front' | 'back' | 'left' | 'right'>('back')

  // ファイルモード用
  const [objFile, setObjFile] = useState<File | null>(null)
  const [mtlFile, setMtlFile] = useState<File | null>(null)

  // 写真モード用
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [dimensions, setDimensions] = useState<ExtractedDimensions | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)

  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const objInputRef = useRef<HTMLInputElement>(null)
  const mtlInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPhotoFile(file)
      setPhotoPreview(URL.createObjectURL(file))
      setDimensions(null)
      setError(null)
    }
  }

  const handleExtractDimensions = async () => {
    if (!photoFile) return

    setIsExtracting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('image', photoFile)
      formData.append('prompt', '荷台・トラックの荷室の内寸を計測してください。幅(width)、奥行き(depth)、高さ(height)をmm単位で出力してください。')

      const response = await fetch(`${API_URL}/api/dimensions/extract`, {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (result.success && result.items.length > 0) {
        const item = result.items[0]
        setDimensions({
          width_mm: item.x_mm,
          depth_mm: item.y_mm,
          height_mm: item.z_mm,
        })
      } else {
        setError(result.error || '寸法の抽出に失敗しました。手動で入力してください。')
        // デフォルト値を設定
        setDimensions({
          width_mm: 2000,
          depth_mm: 4000,
          height_mm: 2000,
        })
      }
    } catch (err) {
      setError('通信エラーが発生しました。手動で入力してください。')
      setDimensions({
        width_mm: 2000,
        depth_mm: 4000,
        height_mm: 2000,
      })
    } finally {
      setIsExtracting(false)
    }
  }

  const handleSubmitFile = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('荷台の名前を入力してください')
      return
    }

    if (!objFile) {
      setError('OBJファイルを選択してください')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('name', name)
      formData.append('entranceDirection', entranceDirection)
      formData.append('objFile', objFile)
      if (mtlFile) {
        formData.append('mtlFile', mtlFile)
      }

      const response = await fetch(`${API_URL}/api/trucks`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'アップロードに失敗しました')
      }

      const truck = await response.json()
      onUpload(truck)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'アップロードに失敗しました')
    } finally {
      setIsUploading(false)
    }
  }

  const handleSubmitPhoto = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('荷台の名前を入力してください')
      return
    }

    if (!dimensions) {
      setError('寸法を入力してください')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      // 寸法からOBJを生成
      const objResponse = await fetch(`${API_URL}/api/dimensions/generate-obj`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{
            id: 'truck_bed',
            name: name,
            x_mm: dimensions.width_mm,
            y_mm: dimensions.depth_mm,
            z_mm: dimensions.height_mm,
          }]
        }),
      })

      if (!objResponse.ok) {
        throw new Error('OBJ生成に失敗しました')
      }

      const objContent = await objResponse.text()
      const objBlob = new Blob([objContent], { type: 'text/plain' })
      const objFile = new File([objBlob], `${name}.obj`, { type: 'text/plain' })

      // 荷台を登録
      const formData = new FormData()
      formData.append('name', name)
      formData.append('entranceDirection', entranceDirection)
      formData.append('objFile', objFile)

      const response = await fetch(`${API_URL}/api/trucks`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '登録に失敗しました')
      }

      const truck = await response.json()
      onUpload(truck)
    } catch (err) {
      setError(err instanceof Error ? err.message : '登録に失敗しました')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">荷台を登録</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* モード切替タブ */}
        <div className="flex mb-4 bg-gray-700 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setMode('photo')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition ${
              mode === 'photo' ? 'bg-blue-500 text-white' : 'text-gray-300 hover:text-white'
            }`}
          >
            写真から作成
          </button>
          <button
            type="button"
            onClick={() => setMode('file')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition ${
              mode === 'file' ? 'bg-blue-500 text-white' : 'text-gray-300 hover:text-white'
            }`}
          >
            OBJファイル
          </button>
        </div>

        <form onSubmit={mode === 'file' ? handleSubmitFile : handleSubmitPhoto} className="space-y-4">
          {/* 名前 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              荷台の名前
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
              placeholder="例: 4tトラック"
            />
          </div>

          {/* 入り口方向 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              入り口方向
            </label>
            <select
              value={entranceDirection}
              onChange={(e) => setEntranceDirection(e.target.value as 'front' | 'back' | 'left' | 'right')}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
            >
              <option value="back">後方</option>
              <option value="front">前方</option>
              <option value="left">左側</option>
              <option value="right">右側</option>
            </select>
          </div>

          {mode === 'file' ? (
            <>
              {/* OBJファイル */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  OBJファイル *
                </label>
                <input
                  ref={objInputRef}
                  type="file"
                  accept=".obj"
                  onChange={(e) => setObjFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => objInputRef.current?.click()}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-left"
                >
                  {objFile ? objFile.name : 'ファイルを選択...'}
                </button>
              </div>

              {/* MTLファイル */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  MTLファイル（オプション）
                </label>
                <input
                  ref={mtlInputRef}
                  type="file"
                  accept=".mtl"
                  onChange={(e) => setMtlFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => mtlInputRef.current?.click()}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-left"
                >
                  {mtlFile ? mtlFile.name : 'ファイルを選択...'}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* 写真アップロード */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  荷台の写真
                </label>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
                {photoPreview ? (
                  <div className="relative">
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="w-full h-40 object-contain bg-gray-900 rounded"
                    />
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="absolute bottom-2 right-2 px-2 py-1 bg-gray-700 text-white text-xs rounded"
                    >
                      変更
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="w-full h-40 border-2 border-dashed border-gray-600 rounded flex flex-col items-center justify-center text-gray-400 hover:border-gray-500"
                  >
                    <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm">クリックして写真を選択</span>
                  </button>
                )}

                {photoFile && !dimensions && (
                  <button
                    type="button"
                    onClick={handleExtractDimensions}
                    disabled={isExtracting}
                    className="w-full mt-2 px-4 py-2 bg-orange-500 text-white rounded disabled:opacity-50"
                  >
                    {isExtracting ? 'AI解析中...' : 'AIで寸法を抽出'}
                  </button>
                )}
              </div>

              {/* 寸法入力 */}
              {(dimensions || error) && (
                <div className="p-3 bg-gray-700 rounded">
                  <div className="text-sm text-gray-300 mb-2">
                    荷台の内寸（mm）
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-gray-400">幅</label>
                      <input
                        type="number"
                        value={dimensions?.width_mm ?? ''}
                        onChange={(e) => setDimensions(prev => ({
                          ...prev!,
                          width_mm: parseInt(e.target.value) || 0
                        }))}
                        className="w-full px-2 py-1 bg-gray-600 text-white rounded"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">奥行き</label>
                      <input
                        type="number"
                        value={dimensions?.depth_mm ?? ''}
                        onChange={(e) => setDimensions(prev => ({
                          ...prev!,
                          depth_mm: parseInt(e.target.value) || 0
                        }))}
                        className="w-full px-2 py-1 bg-gray-600 text-white rounded"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">高さ</label>
                      <input
                        type="number"
                        value={dimensions?.height_mm ?? ''}
                        onChange={(e) => setDimensions(prev => ({
                          ...prev!,
                          height_mm: parseInt(e.target.value) || 0
                        }))}
                        className="w-full px-2 py-1 bg-gray-600 text-white rounded"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDimensions({
                      width_mm: 2000,
                      depth_mm: 4000,
                      height_mm: 2000,
                    })}
                    className="mt-2 text-xs text-blue-400 hover:text-blue-300"
                  >
                    手動で入力
                  </button>
                </div>
              )}
            </>
          )}

          {/* エラー表示 */}
          {error && (
            <div className="text-red-400 text-sm">{error}</div>
          )}

          {/* ボタン */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isUploading || (mode === 'photo' && !dimensions)}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-400 disabled:opacity-50"
            >
              {isUploading ? '登録中...' : '登録'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
