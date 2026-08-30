#!/usr/bin/env bash
# Apply pending SQL migrations in filename order, tracked in a schema_migrations
# table so re-runs are safe. Each migration + its bookkeeping insert run in one
# transaction (-1), so a failing migration leaves nothing half-applied.
#
# Caveat: a migration needing statements that can't run inside a transaction
# (e.g. CREATE INDEX CONCURRENTLY) must be applied by hand.
#
# Usage:
#   DATABASE_URL=postgres://user:pass@host/db ./migrations/run.sh
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB="${DATABASE_URL:-${POSTGRES_URL:-}}"
if [ -z "$DB" ]; then
  echo "Set DATABASE_URL or POSTGRES_URL" >&2
  exit 1
fi

psql "$DB" -v ON_ERROR_STOP=1 -q -c \
  "CREATE TABLE IF NOT EXISTS schema_migrations (
     filename   text PRIMARY KEY,
     applied_at timestamptz NOT NULL DEFAULT now()
   );"

applied_count=0
for f in "$DIR"/[0-9]*.sql; do
  name="$(basename "$f")"
  if [ "$(psql "$DB" -tAc "SELECT 1 FROM schema_migrations WHERE filename = '$name'")" = "1" ]; then
    continue
  fi
  echo "apply $name"
  psql "$DB" -v ON_ERROR_STOP=1 -q -1 \
    -f "$f" \
    -c "INSERT INTO schema_migrations (filename) VALUES ('$name');"
  applied_count=$((applied_count + 1))
done

echo "done — $applied_count migration(s) applied"
