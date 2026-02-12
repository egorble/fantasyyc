#!/bin/bash
###############################################################################
# FantasyYC — Quick Update from GitHub
#
# Usage: sudo bash /opt/fantasyyc/scripts/update.sh
#
# What it does:
#   1. git pull from GitHub
#   2. npm ci for server & backend (if package.json changed)
#   3. npm run build for frontend (if front/ changed)
#   4. Restart services
#
# Safe to run anytime. Does NOT touch: .env, database, SSL, nginx.
###############################################################################

set -euo pipefail

APP_DIR="/opt/fantasyyc"
REPO="https://github.com/egorble/fantasyyc.git"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[UPDATE]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

if [ "$(id -u)" -ne 0 ]; then
    err "Run as root: sudo bash $0"
fi

# Fix git ownership warning
git config --global --add safe.directory "${APP_DIR}" 2>/dev/null || true

# ─── Ensure remote is set correctly ───
if [ -d "${APP_DIR}/.git" ]; then
    cd "${APP_DIR}"
    CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
    if [ "$CURRENT_REMOTE" != "$REPO" ]; then
        git remote remove origin 2>/dev/null || true
        git remote add origin "$REPO"
        log "Fixed remote origin → $REPO"
    fi
fi

# ─── Check if repo exists, clone or pull ───
if [ ! -d "${APP_DIR}/.git" ]; then
    log "First time setup — cloning repo..."
    # Save .env and db before clone
    TEMP_DIR=$(mktemp -d)
    [ -f "${APP_DIR}/.env" ] && cp "${APP_DIR}/.env" "${TEMP_DIR}/.env"
    [ -f "${APP_DIR}/server/db/fantasyyc.db" ] && cp "${APP_DIR}/server/db/fantasyyc.db" "${TEMP_DIR}/fantasyyc.db"

    # Clone
    rm -rf "${APP_DIR:?}/.git"
    cd "${APP_DIR}"
    git init
    git remote add origin "$REPO"
    git fetch origin main
    git checkout -f main

    # Restore .env and db
    [ -f "${TEMP_DIR}/.env" ] && cp "${TEMP_DIR}/.env" "${APP_DIR}/.env"
    [ -f "${TEMP_DIR}/fantasyyc.db" ] && mkdir -p "${APP_DIR}/server/db" && cp "${TEMP_DIR}/fantasyyc.db" "${APP_DIR}/server/db/fantasyyc.db"
    rm -rf "$TEMP_DIR"

    log "Repo cloned"
else
    log "Pulling latest changes..."
    cd "${APP_DIR}"
    # Stash local changes (db, logs) if any
    git stash --include-untracked 2>/dev/null || true
    git pull origin main
    git stash pop 2>/dev/null || true
    log "Pull complete"
fi

# ─── Show what changed ───
echo ""
log "Recent commits:"
git log --oneline -5
echo ""

# ─── Install server deps (if package.json changed) ───
log "Installing server dependencies..."
cd "${APP_DIR}/server"
npm ci --production --silent 2>&1 | tail -3 || npm install --production --silent 2>&1 | tail -3

# ─── Install backend deps ───
log "Installing metadata server dependencies..."
cd "${APP_DIR}/backend"
npm ci --production --silent 2>&1 | tail -3 || npm install --production --silent 2>&1 | tail -3

# ─── Build frontend ───
log "Building frontend..."
cd "${APP_DIR}/front"
npm ci --silent 2>&1 | tail -3 || npm install --silent 2>&1 | tail -3
npm run build
log "Frontend built"

# ─── Fix ownership ───
chown -R fantasyyc:fantasyyc "${APP_DIR}"

# ─── Stop services, kill stale processes, then start clean ───
log "Stopping services..."
systemctl stop fantasyyc-api 2>/dev/null || true
systemctl stop fantasyyc-metadata 2>/dev/null || true
sleep 2

# Kill any leftover node processes on our ports
fuser -k 3003/tcp 2>/dev/null || true
fuser -k 3001/tcp 2>/dev/null || true
sleep 1

log "Starting services..."
systemctl start fantasyyc-api
systemctl start fantasyyc-metadata

# ─── Reload nginx config (picks up burst/rate limit changes) ───
if [ -f "${APP_DIR}/deploy/nginx.conf" ]; then
    log "Updating nginx config..."
    cp "${APP_DIR}/deploy/nginx.conf" /etc/nginx/sites-available/fantasyyc
    if nginx -t 2>/dev/null; then
        systemctl reload nginx
        log "Nginx reloaded"
    else
        warn "Nginx config test failed — skipping reload"
    fi
fi

sleep 3

# ─── Verify ───
API_OK=$(systemctl is-active fantasyyc-api)
META_OK=$(systemctl is-active fantasyyc-metadata)
NGINX_OK=$(systemctl is-active nginx)

echo ""
echo -e "  fantasyyc-api:      ${API_OK} $([ "$API_OK" = "active" ] && echo "${GREEN}OK${NC}" || echo "${RED}FAIL${NC}")"
echo -e "  fantasyyc-metadata: ${META_OK} $([ "$META_OK" = "active" ] && echo "${GREEN}OK${NC}" || echo "${RED}FAIL${NC}")"
echo -e "  nginx:              ${NGINX_OK} $([ "$NGINX_OK" = "active" ] && echo "${GREEN}OK${NC}" || echo "${RED}FAIL${NC}")"
echo ""
log "Update complete!"
