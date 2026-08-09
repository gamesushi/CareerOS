#!/usr/bin/env bash
# CareerOS · Postgres 定时备份（pg_dump -> gzip）
# 配合 cron：每日 04:10 执行（见指南）
#   10 4 * * * /opt/careeros/deploy/backup.sh >> /var/log/careeros-backup.log 2>&1
set -euo pipefail

# 载入生产环境变量（含 DB_USER / DB_PASSWORD / DB_NAME）
set -a
source /opt/careeros/deploy/.env.production
set +a

COMPOSE_FILE=/opt/careeros/deploy/docker-compose.prod.yml
BACKUP_DIR=/var/backups/careeros
mkdir -p "$BACKUP_DIR"

DATE=$(date +%Y%m%d-%H%M%S)
OUT="$BACKUP_DIR/careeros-$DATE.sql.gz"

echo "[$(date)] dumping -> $OUT"
docker compose -f "$COMPOSE_FILE" --env-file /opt/careeros/deploy/.env.production \
  exec -T postgres \
  pg_dump -U "${DB_USER:-careeros}" "${DB_NAME:-careeros}" | gzip > "$OUT"

# 保留 14 天
find "$BACKUP_DIR" -name '*.sql.gz' -mtime +14 -delete
echo "[$(date)] done: $(ls -lh "$OUT" | awk '{print $5, $9}')"
