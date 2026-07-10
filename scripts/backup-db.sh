#!/bin/bash
# Backup da base de dados HostAgente (pg_dump via o container postgres).
# Guarda em ./backups/ com timestamp e mantém os últimos KEEP backups.
# Uso: bash scripts/backup-db.sh   (ou agenda no cron)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

COMPOSE="docker compose -f docker-compose.prod.yml"
BACKUP_DIR="$ROOT_DIR/backups"
KEEP="${KEEP:-14}"           # quantos backups manter
DB="${POSTGRES_DB:-bothosting}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$BACKUP_DIR/hostagente-$STAMP.sql.gz"

echo "A criar backup: $FILE"
$COMPOSE exec -T postgres pg_dump -U postgres "$DB" | gzip > "$FILE"

# Verifica que o ficheiro não está vazio.
if [ ! -s "$FILE" ]; then
  echo "ERRO: backup vazio — a remover." >&2
  rm -f "$FILE"
  exit 1
fi
echo "OK: $(du -h "$FILE" | cut -f1)"

# Limpa backups antigos (mantém os KEEP mais recentes).
ls -1t "$BACKUP_DIR"/hostagente-*.sql.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
echo "Backups guardados: $(ls -1 "$BACKUP_DIR"/hostagente-*.sql.gz 2>/dev/null | wc -l) (a manter $KEEP)"
