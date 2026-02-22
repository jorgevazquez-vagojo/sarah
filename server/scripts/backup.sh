#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# PostgreSQL Backup Script for Sarah
# Usage:
#   ./backup.sh                        # Run directly (requires pg_dump)
#   docker exec sarah-server /app/scripts/backup.sh  # Via docker exec
#   Cron: 0 2 * * * /path/to/backup.sh >> /var/log/sarah-backup.log 2>&1
#
# Environment variables (with defaults):
#   POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB,
#   POSTGRES_USER, PGPASSWORD, BACKUP_DIR,
#   DAILY_RETENTION, WEEKLY_RETENTION
# ──────────────────────────────────────────────────────────
set -euo pipefail

# ─── Configuration ───
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-rdgbot}"
POSTGRES_USER="${POSTGRES_USER:-redegal}"
export PGPASSWORD="${POSTGRES_PASSWORD:-${PGPASSWORD:-}}"

BACKUP_DIR="${BACKUP_DIR:-/backups}"
DAILY_RETENTION="${DAILY_RETENTION:-7}"
WEEKLY_RETENTION="${WEEKLY_RETENTION:-4}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DAY_OF_WEEK=$(date +%u)  # 1=Monday, 7=Sunday

# ─── Create backup directory ───
mkdir -p "${BACKUP_DIR}/daily"
mkdir -p "${BACKUP_DIR}/weekly"

echo "[$(date -Iseconds)] Starting PostgreSQL backup..."

# ─── Create compressed backup ───
DAILY_FILE="${BACKUP_DIR}/daily/${POSTGRES_DB}_daily_${TIMESTAMP}.sql.gz"

pg_dump \
  -h "${POSTGRES_HOST}" \
  -p "${POSTGRES_PORT}" \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  --no-owner \
  --no-privileges \
  --format=plain \
  | gzip -9 > "${DAILY_FILE}"

FILESIZE=$(du -h "${DAILY_FILE}" | cut -f1)
echo "[$(date -Iseconds)] Daily backup created: ${DAILY_FILE} (${FILESIZE})"

# ─── Weekly backup (copy Sunday's daily backup) ───
if [ "${DAY_OF_WEEK}" = "7" ]; then
  WEEKLY_FILE="${BACKUP_DIR}/weekly/${POSTGRES_DB}_weekly_${TIMESTAMP}.sql.gz"
  cp "${DAILY_FILE}" "${WEEKLY_FILE}"
  echo "[$(date -Iseconds)] Weekly backup created: ${WEEKLY_FILE}"
fi

# ─── Cleanup old daily backups (keep last N) ───
DAILY_COUNT=$(ls -1t "${BACKUP_DIR}/daily/"*.sql.gz 2>/dev/null | wc -l)
if [ "${DAILY_COUNT}" -gt "${DAILY_RETENTION}" ]; then
  ls -1t "${BACKUP_DIR}/daily/"*.sql.gz | tail -n +"$((DAILY_RETENTION + 1))" | while read -r OLD_FILE; do
    rm -f "${OLD_FILE}"
    echo "[$(date -Iseconds)] Removed old daily backup: ${OLD_FILE}"
  done
fi

# ─── Cleanup old weekly backups (keep last N) ───
WEEKLY_COUNT=$(ls -1t "${BACKUP_DIR}/weekly/"*.sql.gz 2>/dev/null | wc -l)
if [ "${WEEKLY_COUNT}" -gt "${WEEKLY_RETENTION}" ]; then
  ls -1t "${BACKUP_DIR}/weekly/"*.sql.gz | tail -n +"$((WEEKLY_RETENTION + 1))" | while read -r OLD_FILE; do
    rm -f "${OLD_FILE}"
    echo "[$(date -Iseconds)] Removed old weekly backup: ${OLD_FILE}"
  done
fi

# ─── Summary ───
echo "[$(date -Iseconds)] Backup complete."
echo "  Daily backups:  $(ls -1 "${BACKUP_DIR}/daily/"*.sql.gz 2>/dev/null | wc -l)/${DAILY_RETENTION}"
echo "  Weekly backups: $(ls -1 "${BACKUP_DIR}/weekly/"*.sql.gz 2>/dev/null | wc -l)/${WEEKLY_RETENTION}"
