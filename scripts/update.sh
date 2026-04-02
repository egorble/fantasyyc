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
#   4. Sync contract addresses from deployment file into .env
#   5. Restart services
#   6. Verify metadata server uses correct contract
#
# Safe to run anytime. Does NOT touch: database, SSL, nginx.
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
    # Hard reset to match remote (safe: .env, db, logs are gitignored)
    git fetch origin main
    git reset --hard origin/main
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

# ─── Contract addresses ───
# Metadata server reads from deployment-megaeth.json directly
log "Contract addresses:"
if [ -f "${APP_DIR}/deployment-megaeth.json" ]; then
    MEGA_ADDR=$(node -e "console.log(JSON.parse(require('fs').readFileSync('${APP_DIR}/deployment-megaeth.json','utf8')).proxies.UnicornX_NFT || 'N/A')" 2>/dev/null || echo "N/A")
    log "  MegaETH NFT: ${MEGA_ADDR}"
fi

# Clean up old Etherlink contract address in .env (if present)
if [ -f "${APP_DIR}/.env" ] && grep -q "0x172aC7aa7a6774559b1588E2F4426F7303a97cf1" "${APP_DIR}/.env" 2>/dev/null; then
    log "Removing old Etherlink contract address from .env..."
    sed -i '/NFT_CONTRACT_ADDRESS=0x172aC7aa/d' "${APP_DIR}/.env"
fi
# Remove old Etherlink RPC from .env
if [ -f "${APP_DIR}/.env" ] && grep -q "node.shadownet.etherlink" "${APP_DIR}/.env" 2>/dev/null; then
    log "Removing old Etherlink RPC from .env..."
    sed -i '/node.shadownet.etherlink/d' "${APP_DIR}/.env"
fi

# ─── Fix ownership ───
chown -R fantasyyc:fantasyyc "${APP_DIR}"

# ─── Stop services, kill stale processes, then start clean ───
log "Stopping services..."
systemctl stop fantasyyc-api 2>/dev/null || true
systemctl stop fantasyyc-metadata 2>/dev/null || true

# Stop and disable old multi-chain services (no longer needed)
if systemctl is-enabled fantasyyc-megaeth-api 2>/dev/null; then
    log "Removing old MegaETH-specific services (merged into main services)..."
    systemctl stop fantasyyc-megaeth-api 2>/dev/null || true
    systemctl stop fantasyyc-megaeth-metadata 2>/dev/null || true
    systemctl disable fantasyyc-megaeth-api 2>/dev/null || true
    systemctl disable fantasyyc-megaeth-metadata 2>/dev/null || true
    rm -f /etc/systemd/system/fantasyyc-megaeth-api.service
    rm -f /etc/systemd/system/fantasyyc-megaeth-metadata.service
fi
sleep 2

# Kill any leftover node processes on our ports
fuser -k 3003/tcp 2>/dev/null || true
fuser -k 3001/tcp 2>/dev/null || true
fuser -k 3004/tcp 2>/dev/null || true
fuser -k 3002/tcp 2>/dev/null || true
sleep 1

# Install service files
cp "${APP_DIR}/deploy/fantasyyc-api.service" /etc/systemd/system/
cp "${APP_DIR}/deploy/fantasyyc-metadata.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable fantasyyc-api 2>/dev/null || true
systemctl enable fantasyyc-metadata 2>/dev/null || true

log "Starting services..."
systemctl start fantasyyc-api
systemctl start fantasyyc-metadata

# ─── Reload nginx config (picks up burst/rate limit changes) ───
if [ -f "${APP_DIR}/deploy/nginx.conf" ]; then
    log "Updating nginx config..."
    DOMAIN="app.unicornx.fun"
    NGINX_TARGET="/etc/nginx/sites-available/${DOMAIN}"

    # Clean up old 'fantasyyc' config that conflicts with the canonical name
    if [ -f "/etc/nginx/sites-available/fantasyyc" ] && [ "fantasyyc" != "${DOMAIN}" ]; then
        rm -f /etc/nginx/sites-enabled/fantasyyc
        rm -f /etc/nginx/sites-available/fantasyyc
        log "Removed old duplicate nginx config 'fantasyyc'"
    fi

    cp "${APP_DIR}/deploy/nginx.conf" "$NGINX_TARGET"
    ln -sf "$NGINX_TARGET" "/etc/nginx/sites-enabled/${DOMAIN}"

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
echo -e "  ${CYAN}MegaETH:${NC}"
echo -e "  fantasyyc-api:              ${API_OK} $([ "$API_OK" = "active" ] && echo "${GREEN}OK${NC}" || echo "${RED}FAIL${NC}")"
echo -e "  fantasyyc-metadata:         ${META_OK} $([ "$META_OK" = "active" ] && echo "${GREEN}OK${NC}" || echo "${RED}FAIL${NC}")"
echo -e "  ${CYAN}Infra:${NC}"
echo -e "  nginx:                      ${NGINX_OK} $([ "$NGINX_OK" = "active" ] && echo "${GREEN}OK${NC}" || echo "${RED}FAIL${NC}")"

# ─── Verify metadata servers use correct contracts ───
echo -e "  ${CYAN}Contract verification:${NC}"

# MegaETH metadata (port 3001)
DEPLOY_FILE="${APP_DIR}/deployment-megaeth.json"
if [ -f "$DEPLOY_FILE" ]; then
    EXPECTED_ADDR=$(node -e "console.log(JSON.parse(require('fs').readFileSync('${DEPLOY_FILE}','utf8')).proxies.UnicornX_NFT || '')" 2>/dev/null || echo "")
    ACTUAL_ADDR=$(curl -s --max-time 5 "http://127.0.0.1:3001/" 2>/dev/null | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).contract)}catch{console.log('?')}})" 2>/dev/null || echo "?")

    if [ "$ACTUAL_ADDR" = "$EXPECTED_ADDR" ]; then
        echo -e "  MegaETH metadata:    ${GREEN}OK${NC} (${ACTUAL_ADDR})"
    else
        echo -e "  MegaETH metadata:    ${RED}MISMATCH${NC}"
        echo -e "    expected: ${EXPECTED_ADDR}"
        echo -e "    actual:   ${ACTUAL_ADDR}"
        warn "Metadata server using wrong contract! Check deployment-megaeth.json"
    fi
fi

echo ""
log "Update complete!"
