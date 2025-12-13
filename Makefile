# Hannals - タスクコマンド

# 環境変数
SERVER_IP ?= 153.125.146.112
SSH_USER ?= ubuntu

# ========== ローカル開発 ==========

## 開発サーバー起動
dev:
	pnpm dev

## ビルド
build:
	pnpm build

## 依存関係インストール
install:
	pnpm install

## Prismaマイグレーション（ローカル）
migrate:
	cd packages/backend && npx prisma migrate dev

## Prisma Studio起動
studio:
	cd packages/backend && npx prisma studio

## DBシード実行（2tトラック登録）
seed:
	pnpm --filter backend run db:seed

## デモデータ生成（80%積載量の配置OBJ）
generate-demo:
	pnpm --filter backend run generate:demo

# ========== デプロイ ==========

## 本番デプロイ（ビルド + 転送 + 再起動）
deploy: build deploy-sync deploy-setup

## ファイル転送のみ
deploy-sync:
	rsync -avz --exclude='node_modules' --exclude='.next' --exclude='.git' \
		--exclude='terraform' --exclude='.env*' --exclude='*.log' \
		. $(SSH_USER)@$(SERVER_IP):/opt/hannals/

## サーバーセットアップ
deploy-setup:
	ssh $(SSH_USER)@$(SERVER_IP) '\
		cd /opt/hannals && \
		pnpm install && \
		cd packages/backend && npx prisma migrate deploy && npx prisma generate && \
		cd /opt/hannals && pnpm build && \
		sudo systemctl restart hannals-backend hannals-frontend'

## サービス再起動のみ
restart:
	ssh $(SSH_USER)@$(SERVER_IP) 'sudo systemctl restart hannals-backend hannals-frontend'

## サービス状態確認
status:
	ssh $(SSH_USER)@$(SERVER_IP) 'sudo systemctl status hannals-backend hannals-frontend --no-pager'

## ログ確認（バックエンド）
logs-backend:
	ssh $(SSH_USER)@$(SERVER_IP) 'sudo journalctl -u hannals-backend -f'

## ログ確認（フロントエンド）
logs-frontend:
	ssh $(SSH_USER)@$(SERVER_IP) 'sudo journalctl -u hannals-frontend -f'

## SSHでサーバーに接続
ssh:
	ssh $(SSH_USER)@$(SERVER_IP)

# ========== Terraform ==========

## Terraform初期化
tf-init:
	cd terraform && terraform init

## Terraformプラン確認
tf-plan:
	cd terraform && source .envrc && terraform plan

## Terraformデプロイ
tf-apply:
	cd terraform && source .envrc && terraform apply

## Terraform削除
tf-destroy:
	cd terraform && source .envrc && terraform destroy

## サーバーIP表示
tf-output:
	cd terraform && terraform output

# ========== ヘルプ ==========

## ヘルプ表示
help:
	@echo "使用可能なコマンド:"
	@echo ""
	@echo "  ローカル開発:"
	@echo "    make dev        - 開発サーバー起動"
	@echo "    make build      - ビルド"
	@echo "    make install    - 依存関係インストール"
	@echo "    make migrate    - Prismaマイグレーション"
	@echo "    make studio     - Prisma Studio起動"
	@echo "    make seed       - DBシード（2tトラック登録）"
	@echo "    make generate-demo - デモデータ生成"
	@echo ""
	@echo "  デプロイ:"
	@echo "    make deploy     - 本番デプロイ（全工程）"
	@echo "    make restart    - サービス再起動"
	@echo "    make status     - サービス状態確認"
	@echo "    make logs-backend  - バックエンドログ"
	@echo "    make logs-frontend - フロントエンドログ"
	@echo "    make ssh        - サーバーにSSH接続"
	@echo ""
	@echo "  Terraform:"
	@echo "    make tf-init    - Terraform初期化"
	@echo "    make tf-plan    - プラン確認"
	@echo "    make tf-apply   - インフラデプロイ"
	@echo "    make tf-destroy - インフラ削除"
	@echo ""
	@echo "  オプション:"
	@echo "    SERVER_IP=x.x.x.x  - サーバーIP指定"

.PHONY: dev build install migrate studio seed generate-demo deploy deploy-sync deploy-setup restart status logs-backend logs-frontend ssh tf-init tf-plan tf-apply tf-destroy tf-output help
