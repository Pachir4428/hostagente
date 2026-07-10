#!/bin/bash
# Restaura a base de dados a partir de um backup .sql.gz criado por backup-db.sh.
# Uso: bash scripts/restore-db.sh backups/hostagente-YYYYMMDD-HHMMSS.sql.gz
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

FILE="$1"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "Uso: bash scripts/restore-db.sh <ficheiro.sql.gz>"
  echo "Backups disponíveis:"
  ls -1t backups/hostagente-*.sql.gz 2>/dev/null || echo "  (nenhum)"
  exit 1
fi

COMPOSE="docker compose -f docker-compose.prod.yml"
DB="${POSTGRES_DB:-bothosting}"

echo "⚠️  Isto vai SUBSTITUIR os dados atuais da base '$DB' pelos do backup:"
echo "    $FILE"
read -r -p "Escreve 'RESTAURAR' para confirmar: " confirm
[ "$confirm" = "RESTAURAR" ] || { echo "Cancelado."; exit 1; }

echo "A parar a API/worker para evitar escritas durante o restauro…"
$COMPOSE stop api worker || true

echo "A restaurar…"
gunzip -c "$FILE" | $COMPOSE exec -T postgres psql -U postgres "$DB"

echo "A reiniciar serviços…"
$COMPOSE up -d api worker
echo "✅ Restauro concluído."
