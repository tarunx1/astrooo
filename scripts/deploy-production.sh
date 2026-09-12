#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Tarun Astro Zero-Downtime Safe Production Deployment Script
# ==============================================================================

APP_DIR="${APP_DIR:-/opt/tarun-astro/current}"
PORT="${PORT:-3000}"
HEALTH_URL="http://127.0.0.1:${PORT}/api/health"
READINESS_URL="http://127.0.0.1:${PORT}/api/readiness"

echo "--------------------------------------------------------"
echo "Starting Tarun Astro Safe Production Deployment"
echo "Date: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "--------------------------------------------------------"

if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR"
fi

# 1. Environment Verification
echo "==> Step 1: Checking environment..."
if [ ! -f ".env" ] && [ ! -f "/etc/tarun-astro/tarun-astro.env" ]; then
  echo "WARNING: No .env or environment file found in standard paths!"
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
if command -v pm2 >/dev/null 2>&1 && pm2 describe tarun-astro >/dev/null 2>&1; then
  echo "Reloading via PM2 cluster..."
  pm2 reload ecosystem.config.cjs --update-env
elif command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet tarun-astro 2>/dev/null; then
  echo "Restarting systemd service..."
  sudo systemctl restart tarun-astro
elif command -v launchctl >/dev/null 2>&1 && [ -f ~/Library/LaunchAgents/com.tarun-astro.app.plist ]; then
  echo "Reloading launchd agent..."
  launchctl kickstart -k gui/$(id -u)/com.tarun-astro.app || true
else
  echo "No active supervisor found. If running manually, start with 'pnpm start'."
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
