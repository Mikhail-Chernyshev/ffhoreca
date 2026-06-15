#!/usr/bin/env bash
# Резервная копия SQLite (локально или с Fly volume).
#
# Локально:
#   ./server/scripts/backup-db.sh
#
# С Fly (из корня репозитория):
#   fly ssh console -a ffhoreca-api-tips-from-trips -C "cat /data/catalog.sqlite" > "backups/catalog-$(date +%Y%m%d-%H%M%S).sqlite"

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="${DATABASE_PATH:-$ROOT/server/data/catalog.sqlite}"
DEST_DIR="$ROOT/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$DEST_DIR/catalog-$STAMP.sqlite"

mkdir -p "$DEST_DIR"

if [[ ! -f "$SRC" ]]; then
  echo "База не найдена: $SRC" >&2
  exit 1
fi

cp "$SRC" "$DEST"
echo "Сохранено: $DEST"
