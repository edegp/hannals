#!/bin/bash
# Hannals server setup script

set -e

# Update system
apt-get update
apt-get upgrade -y

# Install dependencies
apt-get install -y \
  curl \
  git \
  nginx \
  certbot \
  python3-certbot-nginx \
  postgresql \
  postgresql-contrib

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install pnpm
npm install -g pnpm

# Setup PostgreSQL
sudo -u postgres psql -c "CREATE USER hannals WITH PASSWORD '${postgres_password}';"
sudo -u postgres psql -c "CREATE DATABASE hannals OWNER hannals;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE hannals TO hannals;"

# Create application directory
mkdir -p /opt/hannals/packages/backend
chown -R ubuntu:ubuntu /opt/hannals

# Create backend .env file
cat > /opt/hannals/packages/backend/.env << ENVEOF
DATABASE_URL="postgresql://hannals:${postgres_password}@localhost:5432/hannals"
SAKURA_API_KEY="${sakura_api_key}"
PORT=8080
NODE_ENV=production
ENVEOF
chown ubuntu:ubuntu /opt/hannals/packages/backend/.env

# Create systemd service for backend
cat > /etc/systemd/system/hannals-backend.service << 'EOF'
[Unit]
Description=Hannals Backend API
After=network.target postgresql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/hannals/packages/backend
EnvironmentFile=/opt/hannals/packages/backend/.env
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Create systemd service for frontend
cat > /etc/systemd/system/hannals-frontend.service << 'EOF'
[Unit]
Description=Hannals Frontend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/hannals/packages/frontend
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=NEXT_PUBLIC_API_URL=http://localhost:8080
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Setup Nginx
cat > /etc/nginx/sites-available/hannals << 'EOF'
server {
    listen 80;
    server_name _;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 100M;
    }

    # Static uploads
    location /uploads/ {
        alias /opt/hannals/packages/backend/uploads/;
    }
}
EOF

ln -sf /etc/nginx/sites-available/hannals /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Reload services
systemctl daemon-reload
systemctl enable nginx
systemctl restart nginx

echo "Setup completed! Please deploy the application to /opt/hannals"
