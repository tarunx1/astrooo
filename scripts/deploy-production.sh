#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Tarun Astro Zero-Downtime Safe Production Deployment Script
# ==============================================================================

if [ -d "/var/www/ravish-astro/current" ]; then
  APP_DIR="/var/www/ravish-astro/current"
  PORT="${PORT:-3001}"
  SERVICE_NAME="ravish-astro"
  ENV_FILE="/etc/ravish-astro/ravish-astro.env"
  USER_RUNNER="ravishastro"
elif [ -d "/opt/tarun-astro/current" ]; then
  APP_DIR="/opt/tarun-astro/current"
  PORT="${PORT:-3000}"
  SERVICE_NAME="tarun-astro"
  ENV_FILE="/etc/tarun-astro/tarun-astro.env"
  USER_RUNNER="Tarun"
else
  APP_DIR="${APP_DIR:-$(pwd)}"
  PORT="${PORT:-3000}"
  SERVICE_NAME="tarun-astro"
  ENV_FILE=".env"
  USER_RUNNER="$(whoami)"
fi

HEALTH_URL="http://127.0.0.1:${PORT}/api/health"
READINESS_URL="http://127.0.0.1:${PORT}/api/readiness"

echo "--------------------------------------------------------"
echo "Starting Tarun Astro Safe Production Deployment"
echo "Target Dir: $APP_DIR"
echo "Service: $SERVICE_NAME (Port: $PORT)"
echo "Date: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "--------------------------------------------------------"

cd "$APP_DIR"

# 1. Environment Verification & Git Sync
echo "==> Step 1: Syncing code and checking environment..."
if [ -d ".git" ]; then
  git fetch origin main || true
  git reset --hard origin/main || true
fi

if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

# 2. Dependency Installation
echo "==> Step 2: Installing dependencies with frozen lockfile..."
pnpm install --frozen-lockfile

# 3. Prisma Schema & Migrations
echo "==> Step 3: Validating Prisma and applying database migrations..."
pnpm prisma validate
pnpm prisma generate
pnpm prisma migrate deploy

# 4. Production Build
echo "==> Step 4: Compiling optimized production build..."
pnpm build

# 5. Zero-Downtime Process Reload
echo "==> Step 5: Reloading service supervisor..."
if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
  echo "Restarting systemd service $SERVICE_NAME..."
  sudo systemctl restart "$SERVICE_NAME"
elif command -v pm2 >/dev/null 2>&1 && pm2 describe tarun-astro >/dev/null 2>&1; then
  echo "Reloading via PM2 cluster..."
  pm2 reload ecosystem.config.cjs --update-env
elif command -v launchctl >/dev/null 2>&1 && [ -f ~/Library/LaunchAgents/com.tarun-astro.app.plist ]; then
  echo "Reloading launchd agent..."
  launchctl kickstart -k gui/$(id -u)/com.tarun-astro.app || true
else
  echo "Restarting service $SERVICE_NAME..."
  sudo systemctl restart "$SERVICE_NAME" 2>/dev/null || true
fi

# 6. Post-Deployment Health Probe
echo "==> Step 6: Verifying service health..."
MAX_ATTEMPTS=20
ATTEMPT=1
HEALTHY=false

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
  sleep 2
  STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" || echo "000")
  if [ "$STATUS_CODE" = "200" ]; then
    echo "Health check succeeded on attempt $ATTEMPT (HTTP 200)"
    HEALTHY=true
    break
  fi
  echo "Waiting for app to become healthy (Attempt $ATTEMPT/$MAX_ATTEMPTS, status: $STATUS_CODE)..."
  ATTEMPT=$((ATTEMPT + 1))
done

if [ "$HEALTHY" = "false" ]; then
  echo "ERROR: Deployment verification failed! $HEALTH_URL returned $STATUS_CODE."
  exit 1
fi

echo "--------------------------------------------------------"
echo "Deployment completed successfully! Live on port ${PORT}."
echo "--------------------------------------------------------"
