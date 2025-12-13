# Hannals - 荷台積載シミュレーションシステム

トラックの荷台に荷物を最適に配置するための3Dシミュレーションシステムです。

## 主な機能

- **荷台3D表示**: OBJファイルを使用した荷台の3Dモデル表示
- **AI寸法抽出**: さくらのAI Engine (Qwen3-VL) を使用して画像から荷物の寸法を自動抽出
- **荷物配置計算**: 外部APIと連携した最適配置計算
- **積み込み順序可視化**: スライダーで積み込み順序をシミュレーション

## システム構成

```
Frontend (Next.js + React Three Fiber)
    │
    ▼
Backend (Hono + PostgreSQL + Prisma)
    │
    ├─▶ さくらのAI Engine (画像→寸法抽出)
    │
    └─▶ 外部配置計算API (配置最適化)
```

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| Frontend | Next.js 16, React Three Fiber, TailwindCSS |
| Backend | Hono, Prisma, PostgreSQL |
| 3D | Three.js, OBJLoader |
| AI | さくらのAI Engine (Qwen3-VL-30B-A3B-Instruct) |
| パッケージ管理 | pnpm (monorepo) |

## セットアップ

### 1. 依存関係のインストール

```bash
pnpm install
```

### 2. 環境変数の設定

#### Backend (`packages/backend/.env`)

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/hannals"
SAKURA_API_KEY="your-sakura-api-key"
EXTERNAL_API_URL="http://localhost:5000"
PORT=8080
```

#### Frontend (`packages/frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL="http://localhost:8080"
```

### 3. データベースのセットアップ

```bash
# PostgreSQLを起動（Docker使用時）
docker-compose up -d

# マイグレーション実行
cd packages/backend
npx prisma migrate dev
```

### 4. 開発サーバーの起動

```bash
# ルートディレクトリで実行（frontend + backend 同時起動）
pnpm dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8080

## 使い方

### 1. 荷台の登録

1. 「荷台を選択」→「新しい荷台を登録」
2. **写真から作成**: 荷台の写真をアップロード → AIで寸法抽出 → OBJ自動生成
3. **OBJファイル**: 3DモデルのOBJ/MTLファイルを直接アップロード

### 2. 荷物の追加

1. 「画像から荷物追加」ボタンをクリック
2. 荷物の写真をアップロード
3. 「AIで寸法を抽出」ボタンで自動抽出
4. 必要に応じて寸法を手動で編集
5. 「この荷物リストを使用」で確定

### 3. 配置計算

1. 荷台を選択
2. 荷物を追加
3. 「荷物を配置」ボタンで配置計算実行
4. スライダーで積み込み順序を確認

## プロジェクト構成

```
hannals/
├── docker-compose.yml
├── pnpm-workspace.yaml
├── docs/
│   └── SPECIFICATION.md      # 詳細仕様書
└── packages/
    ├── backend/
    │   ├── src/
    │   │   ├── index.ts
    │   │   ├── routes/
    │   │   │   ├── trucks.ts       # 荷台API
    │   │   │   ├── placements.ts   # 配置API
    │   │   │   └── dimensions.ts   # AI寸法抽出API
    │   │   └── lib/
    │   │       ├── prisma.ts
    │   │       ├── objGenerator.ts
    │   │       └── mockItemGenerator.ts
    │   ├── prisma/
    │   │   └── schema.prisma
    │   └── uploads/
    └── frontend/
        └── src/
            ├── app/
            │   └── page.tsx
            ├── components/
            │   ├── CargoViewer.tsx
            │   ├── TruckSelector.tsx
            │   ├── TruckUploader.tsx
            │   ├── ImageDimensionExtractor.tsx
            │   ├── OrderSlider.tsx
            │   └── ItemsSidebar.tsx
            └── types/
                └── index.ts
```

## API エンドポイント

### 荷台管理

| Method | Endpoint | 説明 |
|--------|----------|------|
| GET | `/api/trucks` | 荷台一覧取得 |
| POST | `/api/trucks` | 荷台登録 |
| DELETE | `/api/trucks/:id` | 荷台削除 |

### 配置計算

| Method | Endpoint | 説明 |
|--------|----------|------|
| POST | `/api/placements` | 配置計算実行 |
| GET | `/api/placements/:id` | 配置結果取得 |
| POST | `/api/placements/mock/generate` | モックデータ生成 |
| POST | `/api/placements/mock/calculate` | モックデータで配置計算 |

### AI寸法抽出

| Method | Endpoint | 説明 |
|--------|----------|------|
| POST | `/api/dimensions/extract` | 画像から寸法抽出 |
| POST | `/api/dimensions/generate-obj` | 寸法からOBJ生成 |

## 荷物データ形式

```json
{
  "items": [
    {
      "id": "A001",
      "x_mm": 600,
      "y_mm": 400,
      "z_mm": 300,
      "order": 1,
      "weight_kg": 12.5,
      "fragile": false,
      "rot_xy": true
    }
  ]
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| id | string | 荷物ID |
| x_mm | number | 幅（mm） |
| y_mm | number | 奥行き（mm） |
| z_mm | number | 高さ（mm） |
| order | number | 積み込み順 |
| weight_kg | number | 重量（kg） |
| fragile | boolean | 壊れ物フラグ |
| rot_xy | boolean | 水平回転可能 |

## 座標系

### OBJファイル（Z-up、CAD標準）
- X: 幅
- Y: 奥行き
- Z: 高さ

### Three.js（Y-up）
- X: 幅
- Y: 高さ
- Z: 奥行き

※ CargoViewerで自動変換（X軸で-90度回転）

## サンプルデータ

テスト用のサンプルデータを公開しています：

**[サンプルデータ (Google Drive)](https://drive.google.com/drive/folders/1VkcSSj450gkqPLiluSdvMkM-5IVAE6Qq?usp=drive_link)**

- 荷台の3Dモデル（OBJファイル）
- 荷物の写真サンプル
- テスト用寸法データ

## ライセンス

MIT
