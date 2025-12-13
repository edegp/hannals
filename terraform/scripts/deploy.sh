#!/bin/bash
# Deploy Hannals to Sakura Cloud server

set -e

if [ -z "$1" ]; then
  echo "Usage: ./deploy.sh <server-ip>"
  exit 1
fi

SERVER_IP=$1
SSH_USER=${2:-ubuntu}

echo "Deploying Hannals to $SERVER_IP..."

# Build locally
echo "Building application..."
cd "$(dirname "$0")/../.."
pnpm install
pnpm build

# Sync files to server
echo "Syncing files to server..."
rsync -avz --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='terraform' \
  --exclude='*.log' \
  --exclude='.env*' \
  . $SSH_USER@$SERVER_IP:/opt/hannals/

# Install dependencies and setup on server
echo "Installing dependencies on server..."
ssh $SSH_USER@$SERVER_IP << 'EOF'
cd /opt/hannals
pnpm install --frozen-lockfile

# Run Prisma migrations
cd packages/backend
npx prisma migrate deploy
npx prisma generate

# Build applications
cd /opt/hannals
pnpm build

# Restart services
sudo systemctl restart hannals-backend
sudo systemctl restart hannals-frontend
EOF

echo "Deployment completed!"
echo "Frontend: http://$SERVER_IP"
echo "Backend: http://$SERVER_IP/api"
