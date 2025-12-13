# Hannals - さくらクラウドデプロイ

Terraformを使用してさくらクラウドにHannalsをデプロイします。

## 前提条件

1. [Terraform](https://www.terraform.io/downloads) がインストールされていること
2. さくらクラウドのAPIキー（アクセストークン）を取得していること
3. SSHキーペアが生成されていること

## セットアップ

### 1. 環境変数の設定

```bash
export SAKURACLOUD_ACCESS_TOKEN="your-access-token"
export SAKURACLOUD_ACCESS_TOKEN_SECRET="your-access-token-secret"
```

### 2. 変数ファイルの作成

```bash
cp terraform.tfvars.example terraform.tfvars
```

`terraform.tfvars`を編集して必要な値を設定：

```hcl
postgres_password = "secure-password"
sakura_api_key    = "your-sakura-ai-api-key"
```

### 3. Terraformの初期化

```bash
terraform init
```

### 4. プランの確認

```bash
terraform plan
```

### 5. インフラの作成

```bash
terraform apply
```

## デプロイ

サーバーが作成されたら、アプリケーションをデプロイします：

```bash
# IPアドレスを確認
terraform output server_ip

# デプロイスクリプトを実行
./scripts/deploy.sh <server-ip>
```

## リソース構成

| リソース | 説明 |
|---------|------|
| サーバー | Ubuntu 22.04 LTS, 2コア, 4GB RAM |
| ディスク | SSD 40GB |
| ネットワーク | 共有セグメント（グローバルIP付与） |
| ファイアウォール | SSH(22), HTTP(80), HTTPS(443), API(8080) |

## サービス

デプロイ後、以下のサービスが起動します：

- **nginx** - リバースプロキシ（80番ポート）
- **hannals-frontend** - Next.js（3000番ポート）
- **hannals-backend** - Hono API（8080番ポート）
- **postgresql** - データベース

## 管理コマンド

```bash
# SSH接続
ssh ubuntu@<server-ip>

# サービスの状態確認
sudo systemctl status hannals-backend
sudo systemctl status hannals-frontend

# ログ確認
sudo journalctl -u hannals-backend -f
sudo journalctl -u hannals-frontend -f

# サービス再起動
sudo systemctl restart hannals-backend
sudo systemctl restart hannals-frontend
```

## SSL証明書の設定（オプション）

ドメインを設定した場合、Let's Encryptで証明書を取得：

```bash
sudo certbot --nginx -d your-domain.com
```

## クリーンアップ

```bash
terraform destroy
```

## トラブルシューティング

### サーバーに接続できない

1. ファイアウォール設定を確認
2. SSHキーが正しく設定されているか確認
3. サーバーが起動完了しているか確認（数分かかる場合があります）

### アプリケーションが起動しない

```bash
# ログを確認
sudo journalctl -u hannals-backend -n 100
sudo journalctl -u hannals-frontend -n 100

# 環境変数を確認
sudo systemctl cat hannals-backend
```
