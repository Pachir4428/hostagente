#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

echo "=== Bot Platform Deploy ==="

NO_CACHE=""
if [ "$1" = "--no-cache" ]; then
    NO_CACHE="--no-cache"
    echo "Building without Docker layer cache (--no-cache)"
fi

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
docker build $NO_CACHE -t bot-platform-api:latest ./apps/api
docker build $NO_CACHE -t bot-platform-web:latest ./apps/web \
    --build-arg NEXT_PUBLIC_API_URL="${FRONTEND_API_URL:-http://localhost:3000}"
docker build $NO_CACHE -t bot-platform-worker:latest ./apps/worker
docker build $NO_CACHE -t bot-platform-runner:latest ./apps/bot-runner
docker build $NO_CACHE -t bot-engine:latest ./apps/bot-engine

echo "Images built"

# Align the Postgres password with .env BEFORE starting the app services.
# The postgres data volume only reads POSTGRES_PASSWORD on first init, so a
# later change to .env would otherwise cause "P1000 Authentication failed".
# This makes every deploy self-healing for that class of error.
echo "Aligning database password with .env..."
docker compose -f docker-compose.prod.yml up -d postgres
for i in $(seq 1 30); do
    if docker compose -f docker-compose.prod.yml exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
        break
    fi
    sleep 1
done
# Strip optional surrounding quotes, then ALTER USER inside the container,
# doubling single quotes so any special character in the password is safe.
DB_PW="$POSTGRES_PASSWORD"
case "$DB_PW" in
  \"*\") DB_PW=$(printf '%s' "$DB_PW" | sed 's/^"//; s/"$//') ;;
  \'*\') DB_PW=$(printf '%s' "$DB_PW" | sed "s/^'//; s/'$//") ;;
esac
docker compose -f docker-compose.prod.yml exec -T -e NEWPW="$DB_PW" postgres sh -c '
  esc=$(printf "%s" "$NEWPW" | sed "s/'"'"'/'"'"''"'"'/g")
  psql -U postgres -c "ALTER USER postgres PASSWORD '"'"'$esc'"'"';"
' || echo "WARNING: could not align DB password (continuing)"

# Deploy with docker compose
echo "Starting services..."
docker compose -f docker-compose.prod.yml up -d

# Wait for API health check (runs inside the container, host may not have curl)
echo "Waiting for API to be healthy..."
API_READY=""
for i in $(seq 1 30); do
    if docker compose -f docker-compose.prod.yml exec -T api curl -sf http://localhost:3000/health > /dev/null 2>&1; then
        echo "API is healthy!"
        API_READY="1"
        break
    fi
    sleep 2
done

if [ -z "$API_READY" ]; then
    echo "WARNING: API health check timed out. Check logs with: make logs SVC=api"
fi

# Sync the database schema.
# This project ships the Prisma schema without versioned migration files, so
# `prisma migrate deploy` finds nothing to apply and the tables are never
# created. `prisma db push` creates/updates the tables directly from
# schema.prisma, which is what we want for this deployment model. It is
# idempotent, so running it on every deploy is safe.
echo "Syncing database schema (prisma db push)..."
docker compose -f docker-compose.prod.yml exec -T api npx prisma db push --skip-generate || \
    echo "WARNING: Database sync failed. Check logs with: make logs SVC=api"

echo "=== Deployment complete! ==="
docker compose -f docker-compose.prod.yml ps
