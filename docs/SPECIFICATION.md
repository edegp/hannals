# Hannals - 荷台積載シミュレーションシステム 仕様書

## 概要

トラックの荷台に荷物を最適に配置するシミュレーションシステム。
3Dモデルを使用して視覚的に積載状況を確認できる。

---

## システム構成

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Backend       │────▶│   外部API       │
│   (Next.js)     │     │   (Hono)        │     │   (ngrok)       │
│   React Three   │◀────│   PostgreSQL    │◀────│   配置計算      │
│   Fiber         │     │   Prisma        │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │ さくらのAI      │
                        │ Engine          │
                        │ (Qwen3-VL)      │
                        │ 画像→寸法抽出   │
                        └─────────────────┘
```

---

## 機能フロー

### 1. 荷台登録

```
[ユーザー]
    │
    ├── 1. 荷台の3Dモデル（OBJ/MTL）をアップロード
    │
    ├── 2. 入り口（積み込み口）の方向をクリックで指定
    │       - 前方 (front)
    │       - 後方 (back)  ← 通常はこれ
    │       - 左側 (left)
    │       - 右側 (right)
    │
    └── 3. 名前を付けて保存
            │
            ▼
        [Backend] → PostgreSQLに保存
```

### 2. 画像から寸法抽出（AI）

```
[ユーザー]
    │
    ├── 1. 荷物の写真をアップロード
    │
    └── 2. 「AIで寸法を抽出」ボタン
            │
            ▼
        [Backend]
            │
            ├── 画像をBase64エンコード
            │
            └── さくらのAI Engine (Qwen3-VL) に送信
                    │
                    ▼
                [AI Engine]
                    │
                    ├── 画像解析
                    │
                    └── JSON形式で寸法を返却
                            │
                            ▼
        [Frontend] → 抽出結果を編集可能なフォームで表示
                            │
                            └── 確定後、荷物リストに追加
```

### 3. 荷物配置

```
[ユーザー]
    │
    ├── 1. 保存済みの荷台を選択
    │
    ├── 2. 荷物データを入力/送信（または画像から抽出）
    │       {
    │         "items": [
    │           { "id": "A001", "x_mm": 600, "y_mm": 400, "z_mm": 300, ... },
    │           ...
    │         ]
    │       }
    │
    └── 3. 「配置計算」ボタン
            │
            ▼
        [Backend]
            │
            ├── 荷台3Dデータ + 荷物データを外部APIに送信
            │
            ▼
        [外部API (ngrok)]
            │
            ├── 配置計算
            │
            └── 配置結果の3Dデータを返却
                    │
                    ▼
        [Frontend] → 3D表示 + スライダーで積み込み順確認
```

---

## データ構造

### 荷物データ（入力）

```json
{
  "items": [
    {
      "id": "A001",
      "x_mm": 600,
      "y_mm": 400,
      "z_mm": 300,
      "order": 3,
      "weight_kg": 12.5,
      "fragile": false,
      "rot_xy": true
    },
    {
      "id": "B010",
      "x_mm": 205,
      "y_mm": 195,
      "z_mm": 180,
      "order": 1,
      "weight_kg": 5.2,
      "fragile": true,
      "rot_xy": false
    }
  ]
}
```

| フィールド | 型      | 説明                  |
| ---------- | ------- | --------------------- |
| id         | string  | 荷物ID                |
| x_mm       | number  | 幅（mm）              |
| y_mm       | number  | 奥行き（mm）          |
| z_mm       | number  | 高さ（mm）            |
| order      | number  | 積み込み順（1が最初） |
| weight_kg  | number  | 重量（kg）            |
| fragile    | boolean | 壊れ物フラグ          |
| rot_xy     | boolean | XY平面で回転可能か    |

### 配置結果（外部APIからのレスポンス）

```json
{
  "success": true,
  "placedItems": [
    {
      "id": "A001",
      "x_mm": 600,
      "y_mm": 400,
      "z_mm": 300,
      "order": 3,
      "weight_kg": 12.5,
      "fragile": false,
      "rot_xy": true,
      "posX": 0,
      "posY": 0,
      "posZ": 0,
      "rotation": 0
    }
  ],
  "unplacedItems": []
}
```

| フィールド | 型     | 説明                      |
| ---------- | ------ | ------------------------- |
| posX       | number | 配置位置X（mm、原点基準） |
| posY       | number | 配置位置Y（mm、原点基準） |
| posZ       | number | 配置位置Z（mm、原点基準） |
| rotation   | number | 回転角度（度）            |

---

## API仕様

### Backend API (Hono)

#### 荷台

| Method | Endpoint          | 説明                               |
| ------ | ----------------- | ---------------------------------- |
| GET    | `/api/trucks`     | 荷台一覧取得                       |
| GET    | `/api/trucks/:id` | 荷台詳細取得                       |
| POST   | `/api/trucks`     | 荷台登録（3Dファイルアップロード） |
| DELETE | `/api/trucks/:id` | 荷台削除                           |

#### 配置

| Method | Endpoint              | 説明                                  |
| ------ | --------------------- | ------------------------------------- |
| POST   | `/api/placements`     | 配置計算リクエスト（外部API呼び出し） |
| GET    | `/api/placements/:id` | 配置結果取得                          |

#### 寸法抽出（AI）

| Method | Endpoint                       | 説明                                  |
| ------ | ------------------------------ | ------------------------------------- |
| POST   | `/api/dimensions/extract`      | 画像から寸法を抽出（さくらAI Engine） |
| POST   | `/api/dimensions/generate-obj` | 寸法からOBJファイルを生成             |
| GET    | `/api/dimensions/models`       | 利用可能なAIモデル情報を取得          |

**寸法抽出リクエスト（multipart/form-data）:**
- `image`: 画像ファイル
- `prompt`: 追加のプロンプト（オプション）

**寸法抽出レスポンス:**
```json
{
  "success": true,
  "items": [
    {
      "id": "item_1",
      "name": "段ボール箱",
      "x_mm": 400,
      "y_mm": 300,
      "z_mm": 250,
      "weight_kg": 5.0,
      "fragile": false
    }
  ],
  "rawResponse": "..."
}
```

### 外部API (ngrok)

| Method | Endpoint     | 説明     |
| ------ | ------------ | -------- |
| POST   | `/calculate` | 配置計算 |

**リクエスト:**
```json
{
  "truck": {
    "objData": "...(OBJファイルの内容)...",
    "mtlData": "...(MTLファイルの内容、オプション)...",
    "entranceDirection": "back"
  },
  "items": [...]
}
```

**レスポンス:**
```json
{
  "success": true,
  "placedItems": [...],
  "unplacedItems": [...]
}
```

---

## フロントエンド機能

### 3Dビューアー

- 荷台の3Dモデル表示
- 配置された荷物を3Dボックスで表示
- マウス操作（回転、ズーム、移動）
- 荷物クリックで選択

### 積み込み順スライダー

- スライダーを動かすと、その順番までの荷物を表示
- 積み込み順序のシミュレーション

### サイドバー

- 選択中の荷物情報
  - ID、サイズ、重量
  - 壊れ物フラグ
  - 配置位置
- 荷物一覧（クリックで選択）

---

## 座標系

### 建築系（Rhino等）
- X: 横
- Y: 奥行き
- Z: 高さ

### Three.js
- X: 横
- Y: 高さ（上）
- Z: 奥行き（手前）

**変換:** X軸で-90度回転

---

## 技術スタック

| レイヤー       | 技術                                          |
| -------------- | --------------------------------------------- |
| Frontend       | Next.js, React Three Fiber, TailwindCSS       |
| Backend        | Hono, Prisma, PostgreSQL                      |
| 3D             | Three.js, OBJLoader, MTLLoader                |
| AI             | さくらのAI Engine (Qwen3-VL-30B-A3B-Instruct) |
| インフラ       | Docker, さくらインターネットクラウド          |
| パッケージ管理 | pnpm (monorepo)                               |

---

## ディレクトリ構成

```
hannals/
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json
├── docs/
│   └── SPECIFICATION.md
└── packages/
    ├── backend/
    │   ├── src/
    │   │   ├── index.ts
    │   │   ├── routes/
    │   │   │   ├── trucks.ts
    │   │   │   ├── placements.ts
    │   │   │   └── dimensions.ts    # AI寸法抽出
    │   │   └── lib/
    │   │       ├── prisma.ts
    │   │       └── objGenerator.ts  # OBJ生成
    │   ├── prisma/
    │   │   └── schema.prisma
    │   └── uploads/          # アップロードされた3Dファイル
    └── frontend/
        └── src/
            ├── app/
            │   └── page.tsx
            ├── components/
            │   ├── CargoViewer.tsx
            │   ├── OrderSlider.tsx
            │   ├── ItemsSidebar.tsx
            │   ├── TruckUploader.tsx
            │   ├── TruckSelector.tsx
            │   └── ImageDimensionExtractor.tsx  # 画像寸法抽出UI
            └── types/
                └── index.ts
```

---

## 実装済み機能

- [x] 3Dファイルアップロード機能（荷台登録）
- [x] 荷台一覧・選択UI
- [x] 画像からの寸法抽出（さくらのAI Engine）
- [x] 寸法からOBJファイル生成
- [x] 配置計算（フォールバックアルゴリズム）
- [x] 配置結果の保存・履歴

## 今後の実装タスク

- [ ] 外部API連携（ngrok）の本番設定
- [ ] さくらクラウドへのデプロイ
- [ ] 荷物の手動編集UI
- [ ] 配置結果のエクスポート機能

## 環境変数

| 変数名           | 説明                    | 例                                            |
| ---------------- | ----------------------- | --------------------------------------------- |
| DATABASE_URL     | PostgreSQL接続URL       | postgresql://user:pass@localhost:5432/hannals |
| SAKURA_API_KEY   | さくらAI Engine APIキー | sk-xxx                                        |
| VISION_MODEL     | 使用するVisionモデル    | preview/Qwen3-VL-30B-A3B-Instruct             |
| EXTERNAL_API_URL | 外部配置計算API URL     | http://localhost:5000                         |

