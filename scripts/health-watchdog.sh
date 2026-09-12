#!/usr/bin/env bash
# ==============================================================================
# Tarun Astro Liveness & Health Watchdog Daemon
# Automatically recovers and restarts the service if it ever hangs or crashes
# ==============================================================================

PORT="${PORT:-3000}"
HEALTH_URL="http://127.0.0.1:${PORT}/api/health"
CHECK_INTERVAL_SECONDS="${CHECK_INTERVAL_SECONDS:-15}"
MAX_FAILURES=3
FAILURE_COUNT=0
LOG_FILE="./logs/watchdog.log"

mkdir -p ./logs

log() {
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $1" | tee -a "$LOG_FILE"
}

log "Starting health watchdog for ${HEALTH_URL} (interval: ${CHECK_INTERVAL_SECONDS}s, threshold: ${MAX_FAILURES} failures)..."

restart_service() {
  log "TRIGGERING AUTO-HEAL: Restarting Tarun Astro application..."
  
  if command -v pm2 >/dev/null 2>&1 && pm2 describe tarun-astro >/dev/null 2>&1; then
    pm2 restart tarun-astro >> "$LOG_FILE" 2>&1
  elif command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet tarun-astro 2>/dev/null; then
    sudo systemctl restart tarun-astro >> "$LOG_FILE" 2>&1
  elif command -v launchctl >/dev/null 2>&1 && [ -f ~/Library/LaunchAgents/com.tarun-astro.app.plist ]; then
    launchctl kickstart -k gui/$(id -u)/com.tarun-astro.app >> "$LOG_FILE" 2>&1 || true
  else
    log "No system supervisor detected. Sending SIGHUP to port ${PORT} listeners..."
    fuser -k -HUP "${PORT}/tcp" 2>/dev/null || true
  fi

  sleep 5
}

while true; do
  HTTP_CODE=$(curl -s -m 5 -o /dev/null -w "%{http_code}" "$HEALTH_URL" || echo "000")

  if [ "$HTTP_CODE" = "200" ]; then
    if [ "$FAILURE_COUNT" -gt 0 ]; then
      log "Health restored successfully (HTTP 200)."
    fi
    FAILURE_COUNT=0
  else
    FAILURE_COUNT=$((FAILURE_COUNT + 1))
    log "Health check failed (HTTP ${HTTP_CODE}, failure ${FAILURE_COUNT}/${MAX_FAILURES})."

    if [ "$FAILURE_COUNT" -ge "$MAX_FAILURES" ]; then
      log "Failure threshold reached!"
      restart_service
      FAILURE_COUNT=0
    fi
  fi

  sleep "$CHECK_INTERVAL_SECONDS"
done
