#!/usr/bin/env bash
# ==============================================================================
# Tarun Astro Persistent Cloudflare Tunnel Daemon
# Automatically restarts and reconnects across network blips or disconnections
# ==============================================================================

PORT="${PORT:-3000}"
TUNNEL_TOKEN="${CLOUDFLARE_TUNNEL_TOKEN:-}"
LOG_FILE="./logs/tunnel.log"

mkdir -p ./logs

log() {
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $1" | tee -a "$LOG_FILE"
}

log "Starting persistent Cloudflare tunnel daemon for port ${PORT}..."

while true; do
  if [ -n "$TUNNEL_TOKEN" ]; then
    log "Running named tunnel with token..."
    cloudflared tunnel run --token "$TUNNEL_TOKEN" >> "$LOG_FILE" 2>&1 || true
  else
    log "Running quick trycloudflare tunnel on http://127.0.0.1:${PORT}..."
    cloudflared tunnel --url "http://127.0.0.1:${PORT}" >> "$LOG_FILE" 2>&1 || true
  fi

  log "Tunnel exited or disconnected. Reconnecting in 3 seconds..."
  sleep 3
done
