#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3000}"

echo "Starting Cloudflare Quick Tunnel for port ${PORT}..."
echo "Press Ctrl+C to stop."
echo ""

exec cloudflared tunnel --url "http://127.0.0.1:${PORT}"
