'use client'

import { useState, useRef } from 'react'
import { Item } from '@/types'

interface CsvImporterProps {
  onItemsImported: (items: Item[]) => void
  onClose: () => void
}

export function CsvImporter({ onItemsImported, onClose }: CsvImporterProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [parsedItems, setParsedItems] = useState<Item[]>([])
  const [error, setError] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<string[][]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setError(null)
      parseCSV(file)
    }
  }

  const parseCSV = async (file: File) => {
    try {
      const text = await file.text()
      const lines = text.trim().split('\n')

      if (lines.length < 2) {
        setError('CSVファイルにデータがありません')
        return
      }

      // ヘッダー行を解析
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())

      // 必須カラムのチェック
      const requiredColumns = ['id', 'x_mm', 'y_mm', 'z_mm']
      const missingColumns = requiredColumns.filter(col => !headers.includes(col))

      if (missingColumns.length > 0) {
        setError(`必須カラムがありません: ${missingColumns.join(', ')}`)
        return
      }

      // プレビュー用にヘッダーと最初の5行を保存
      const preview = lines.slice(0, 6).map(line => line.split(',').map(cell => cell.trim()))
      setPreviewData(preview)

      // データ行を解析
      const items: Item[] = []
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim())

        if (values.length < headers.length) continue

        const row: Record<string, string> = {}
        headers.forEach((header, index) => {
          row[header] = values[index] || ''
        })

        // booleanの解析
        const parseBoolean = (value: string): boolean => {
          const lower = value.toLowerCase()
          return lower === 'true' || lower === '1' || lower === 'yes'
        }

        const item: Item = {
          id: row['id'] || `item_${i}`,
          x_mm: parseInt(row['x_mm']) || 0,
          y_mm: parseInt(row['y_mm']) || 0,
          z_mm: parseInt(row['z_mm']) || 0,
          order: parseInt(row['order']) || i,
          weight_kg: parseFloat(row['weight_kg']) || 1.0,
          fragile: parseBoolean(row['fragile'] || 'false'),
          rot_xy: row['rot_xy'] ? parseBoolean(row['rot_xy']) : true,
        }

        // バリデーション
        if (item.x_mm > 0 && item.y_mm > 0 && item.z_mm > 0) {
          items.push(item)
        }
      }

      if (items.length === 0) {
        setError('有効なアイテムデータがありません')
        return
      }

      setParsedItems(items)
    } catch (err) {
      setError('CSVの解析に失敗しました')
      console.error(err)
    }
  }

  const handleImport = () => {
    if (parsedItems.length > 0) {
      onItemsImported(parsedItems)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && file.name.endsWith('.csv')) {
      setSelectedFile(file)
      setError(null)
      parseCSV(file)
    } else {
      setError('CSVファイルをドロップしてください')
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">CSVから荷物をインポート</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">
            &times;
          </button>
        </div>

        {/* ファイル選択エリア */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center mb-4 hover:border-blue-500 transition-colors"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          <p className="text-gray-400 mb-4">
            CSVファイルをドラッグ＆ドロップ<br />
            または
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            ファイルを選択
          </button>
          {selectedFile && (
            <p className="mt-4 text-green-400">
              選択中: {selectedFile.name}
            </p>
          )}
        </div>

        {/* CSVフォーマット説明 */}
        <div className="bg-gray-700 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-medium text-gray-300 mb-2">CSVフォーマット</h3>
          <code className="text-xs text-gray-400 block">
            id,x_mm,y_mm,z_mm,order,weight_kg,fragile,rot_xy
          </code>
          <ul className="text-xs text-gray-400 mt-2 space-y-1">
            <li>・<strong>必須</strong>: id, x_mm, y_mm, z_mm</li>
            <li>・order: 積み込み順（省略時は行番号）</li>
            <li>・weight_kg: 重量kg（省略時は1.0）</li>
            <li>・fragile: 壊れ物（true/false）</li>
            <li>・rot_xy: 回転可能（true/false、省略時はtrue）</li>
          </ul>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-3 mb-4">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {/* プレビュー */}
        {previewData.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-300 mb-2">
              プレビュー（最初の5行）
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-gray-300">
                <thead>
                  <tr className="bg-gray-700">
                    {previewData[0]?.map((header, i) => (
                      <th key={i} className="px-2 py-1 text-left">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(1).map((row, i) => (
                    <tr key={i} className="border-t border-gray-700">
                      {row.map((cell, j) => (
                        <td key={j} className="px-2 py-1">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 解析結果 */}
        {parsedItems.length > 0 && (
          <div className="bg-green-900/30 border border-green-500 rounded-lg p-3 mb-4">
            <p className="text-green-300">
              {parsedItems.length}件のアイテムを読み込みました
            </p>
          </div>
        )}

        {/* アクションボタン */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500"
          >
            キャンセル
          </button>
          <button
            onClick={handleImport}
            disabled={parsedItems.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            インポート ({parsedItems.length}件)
          </button>
        </div>
      </div>
    </div>
  )
}
