#!/usr/bin/env bash
set -euo pipefail

set -a
source /opt/tarun-astro/env/tarun-astro.env
set +a

cd /opt/tarun-astro/current
exec pnpm start
