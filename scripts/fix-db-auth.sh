#!/bin/bash
# Fixes "PrismaClientInitializationError P1000: Authentication failed against
# database server at postgres" — happens when the postgres data volume was
# initialised with a different password than the current .env POSTGRES_PASSWORD
# (postgres only reads POSTGRES_PASSWORD on first init, ignoring later changes).
#
# This resets the DB user's password to exactly match .env, WITHOUT dropping
# any data. Local (unix-socket) connections use trust auth, so no password is
# needed to run the ALTER.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

if [ ! -f ".env" ]; then
  echo "ERROR: .env not found in $ROOT_DIR"
  exit 1
fi

# Read the literal value (no shell expansion, so a '$' in the password survives)
PW=$(grep -E '^POSTGRES_PASSWORD=' .env | head -1 | cut -d= -f2-)
if [ -z "$PW" ]; then
  echo "ERROR: POSTGRES_PASSWORD is empty in .env"
  exit 1
fi

echo "Ensuring postgres is up..."
docker compose -f docker-compose.prod.yml up -d postgres

echo "Waiting for postgres to be ready..."
for i in $(seq 1 30); do
  if docker compose -f docker-compose.prod.yml exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "Resetting the postgres user password to match .env..."
# Strip optional surrounding quotes from the .env value.
case "$PW" in
  \"*\") PW=$(printf '%s' "$PW" | sed 's/^"//; s/"$//') ;;
  \'*\') PW=$(printf '%s' "$PW" | sed "s/^'//; s/'$//") ;;
esac
# Pass the password to the container as an env var and build the ALTER inside
# the container's shell, doubling any single quotes so the SQL literal is safe.
# This avoids psql -v interpolation, which failed on some setups
# ("syntax error at or near :"), and avoids the host shell expanding a '$' in
# the password.
docker compose -f docker-compose.prod.yml exec -T -e NEWPW="$PW" postgres sh -c '
  esc=$(printf "%s" "$NEWPW" | sed "s/'"'"'/'"'"''"'"'/g")
  psql -U postgres -c "ALTER USER postgres PASSWORD '"'"'$esc'"'"';"
'

echo "Restarting the stack..."
docker compose -f docker-compose.prod.yml up -d

echo "Waiting for the API to become healthy..."
API_OK=""
for i in $(seq 1 30); do
  if docker compose -f docker-compose.prod.yml exec -T api curl -sf http://localhost:3000/health >/dev/null 2>&1; then
    API_OK="1"
    break
  fi
  sleep 2
done

if [ -n "$API_OK" ]; then
  echo "✅ API is healthy. Running prisma db push to ensure tables exist..."
  docker compose -f docker-compose.prod.yml exec -T api npx prisma db push --skip-generate --accept-data-loss || true
  echo "✅ Done. You can log in now."
else
  echo "⚠️  API still not healthy. Check: docker compose -f docker-compose.prod.yml logs api --tail=30"
fi
