#!/bin/bash
set -e

echo "=== Bot Platform VPS Setup ==="

# Non-interactive apt (avoids prompts hanging the script over SSH)
export DEBIAN_FRONTEND=noninteractive

# Pre-configure timezone so tzdata's postinstall script doesn't try to
# prompt interactively during "apt-get upgrade" (this is the #1 cause of
# "dpkg returned an error code (1)" on fresh VPS images).
ln -fs /usr/share/zoneinfo/UTC /etc/localtime
echo "Etc/UTC" > /etc/timezone

# Repair any package left half-configured by a previous failed run
dpkg --configure -a || true

# Update system
apt-get update && apt-get upgrade -y

# Install essential packages
apt-get install -y curl wget git ufw nginx certbot python3-certbot-nginx apt-transport-https ca-certificates gnupg lsb-release

# Install Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable docker
systemctl start docker

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "Node version: $(node -v)"
echo "npm version: $(npm -v)"
echo "Docker version: $(docker --version)"

# Setup UFW firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp
ufw allow 3001/tcp
ufw --force enable

echo "Firewall configured"

# Create Docker network
docker network create bot-network 2>/dev/null || true

# Setup nginx
cat > /etc/nginx/sites-available/bot-platform << 'NGINX'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        rewrite ^/api(/.*)$ $1 break;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/bot-platform /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "=== Setup complete! ==="
echo "Next steps:"
echo "1. cp .env.example .env"
echo "2. nano .env   # fill in passwords and secrets"
echo "3. make deploy   (or: bash scripts/deploy.sh)"
