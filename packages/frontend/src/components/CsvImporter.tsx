'use client'

import { useState, useRef } from 'react'
import { Item } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { X, Upload, FileSpreadsheet, Check, AlertCircle } from 'lucide-react'

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

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())

      const requiredColumns = ['id', 'x_mm', 'y_mm', 'z_mm']
      const missingColumns = requiredColumns.filter(col => !headers.includes(col))

      if (missingColumns.length > 0) {
        setError(`必須カラムがありません: ${missingColumns.join(', ')}`)
        return
      }

      const preview = lines.slice(0, 6).map(line => line.split(',').map(cell => cell.trim()))
      setPreviewData(preview)

      const items: Item[] = []
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim())

        if (values.length < headers.length) continue

        const row: Record<string, string> = {}
        headers.forEach((header, index) => {
          row[header] = values[index] || ''
        })

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
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              CSVから荷物をインポート
            </CardTitle>
            <CardDescription className="mt-1">
              荷物データをCSVファイルから読み込みます
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* File Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              CSVファイルをドラッグ＆ドロップ<br />
              またはクリックして選択
            </p>
            {selectedFile && (
              <Badge variant="secondary" className="mt-2">
                <FileSpreadsheet className="h-3 w-3 mr-1" />
                {selectedFile.name}
              </Badge>
            )}
          </div>

          {/* CSV Format Description */}
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <h3 className="text-sm font-medium mb-2">CSVフォーマット</h3>
              <code className="text-xs text-muted-foreground block bg-background p-2 rounded">
                id,x_mm,y_mm,z_mm,order,weight_kg,fragile,rot_xy
              </code>
              <ul className="text-xs text-muted-foreground mt-3 space-y-1">
                <li className="flex items-center gap-1">
                  <Badge variant="destructive" className="text-[10px] px-1 py-0">必須</Badge>
                  id, x_mm, y_mm, z_mm
                </li>
                <li>・order: 積み込み順（省略時は行番号）</li>
                <li>・weight_kg: 重量kg（省略時は1.0）</li>
                <li>・fragile: 壊れ物（true/false）</li>
                <li>・rot_xy: 回転可能（true/false、省略時はtrue）</li>
              </ul>
            </CardContent>
          </Card>

          {/* Error Display */}
          {error && (
            <Card className="border-destructive bg-destructive/10">
              <CardContent className="p-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* Preview */}
          {previewData.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">
                プレビュー（最初の5行）
              </h3>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted">
                      {previewData[0]?.map((header, i) => (
                        <th key={i} className="px-3 py-2 text-left font-medium">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.slice(1).map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        {row.map((cell, j) => (
                          <td key={j} className="px-3 py-2">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Success Message */}
          {parsedItems.length > 0 && (
            <Card className="border-green-500 bg-green-500/10">
              <CardContent className="p-3 flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <p className="text-sm text-green-500">
                  {parsedItems.length}件のアイテムを読み込みました
                </p>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button
              onClick={handleImport}
              disabled={parsedItems.length === 0}
            >
              インポート ({parsedItems.length}件)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
