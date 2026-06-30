#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

echo "=== Bot Platform Deploy ==="

# Validate .env exists
if [ ! -f ".env" ]; then
    echo "ERROR: .env file not found. Copy .env.example to .env and fill in values."
    exit 1
fi

# Validate required env vars
required_vars=(
    "POSTGRES_PASSWORD"
    "REDIS_PASSWORD"
    "JWT_SECRET"
    "JWT_REFRESH_SECRET"
    "INTERNAL_SECRET"
)

source .env

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "ERROR: Required environment variable $var is not set in .env"
        exit 1
    fi
done

echo "Environment validated"

# Pull latest code
if git remote -v | grep -q origin; then
    echo "Pulling latest code..."
    git pull origin "$(git branch --show-current)" || echo "Git pull failed, continuing with local code"
fi

# Create Docker network if not exists
docker network create bot-network 2>/dev/null || true

# Build images
echo "Building Docker images..."
docker build -t bot-platform-api:latest ./apps/api
docker build -t bot-platform-web:latest ./apps/web \
    --build-arg NEXT_PUBLIC_API_URL="${FRONTEND_API_URL:-http://localhost:3000}"
docker build -t bot-platform-worker:latest ./apps/worker
docker build -t bot-platform-runner:latest ./apps/bot-runner
docker build -t bot-engine:latest ./apps/bot-engine

echo "Images built"

# Deploy with docker compose
echo "Starting services..."
docker compose -f docker-compose.prod.yml up -d

# Wait for API health check
echo "Waiting for API to be healthy..."
for i in $(seq 1 30); do
    if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
        echo "API is healthy!"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "WARNING: API health check timed out"
    fi
    sleep 2
done

echo "=== Deployment complete! ==="
docker compose -f docker-compose.prod.yml ps
