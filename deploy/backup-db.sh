#!/bin/bash
# FantasyYC — Daily database backup
# Runs via cron: 0 3 * * * /opt/fantasyyc/deploy/backup-db.sh

set -euo pipefail

BACKUP_DIR="/opt/fantasyyc/backups"
DB_FILE="/opt/fantasyyc/server/db/fantasyyc.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
KEEP_DAYS=30
LOG_FILE="/opt/fantasyyc/logs/backup.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Ensure backup dir exists
mkdir -p "$BACKUP_DIR"

# Check DB exists
if [ ! -f "$DB_FILE" ]; then
    log "ERROR: Database file not found: $DB_FILE"
    exit 1
fi

# Create backup (copy while service is running — sql.js saves atomically)
BACKUP_FILE="${BACKUP_DIR}/fantasyyc_${TIMESTAMP}.db"
cp "$DB_FILE" "$BACKUP_FILE"

# Verify backup
ORIG_SIZE=$(stat -c%s "$DB_FILE")
BACK_SIZE=$(stat -c%s "$BACKUP_FILE")

if [ "$BACK_SIZE" -lt 1024 ]; then
    log "ERROR: Backup too small (${BACK_SIZE} bytes), possible corruption"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Compress
gzip "$BACKUP_FILE"
COMPRESSED_SIZE=$(stat -c%s "${BACKUP_FILE}.gz")

log "OK: Backup created ${BACKUP_FILE}.gz (original: ${ORIG_SIZE}B, compressed: ${COMPRESSED_SIZE}B)"

# Delete old backups (older than KEEP_DAYS)
DELETED=$(find "$BACKUP_DIR" -name "fantasyyc_*.db.gz" -mtime +${KEEP_DAYS} -delete -print | wc -l)
if [ "$DELETED" -gt 0 ]; then
    log "Cleaned up $DELETED old backups (>${KEEP_DAYS} days)"
fi
