# Oracle Free Cloud Deploy

This app can run on an Oracle Cloud Infrastructure Always Free Ampere A1 VM as a
single-node deployment:

- Nginx on ports 80/443
- Next.js on localhost port 3000
- Postgres on the VM or an external Postgres provider
- Upstash Redis REST for distributed rate limiting
- S3-compatible object storage for generated report PDFs

Oracle's Always Free Autonomous Database is not a drop-in replacement for this
app because the Prisma schema is Postgres-based. Use local Postgres on the VM or
a managed Postgres service.

## Free Tier Fit

Use `VM.Standard.A1.Flex` with 2 OCPUs and 12 GB RAM if capacity is available in
the tenancy home region. That is the practical Always Free shape for a Next.js
app plus Postgres. The AMD `VM.Standard.E2.1.Micro` shape has only 1 GB RAM and
is too small for reliable builds.

Oracle references:

- Free Tier overview: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm
- Always Free resources: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm

## OCI Setup

1. Create a Compute instance:
   - Shape: `VM.Standard.A1.Flex`
   - OCPUs: `2`
   - Memory: `12 GB`
   - OS: Ubuntu 24.04 LTS or Ubuntu 22.04 LTS
   - Boot volume: default 47 GB or larger, staying inside Always Free limits
   - Public IPv4: enabled
2. Add ingress rules to the VM security list or network security group:
   - TCP `22` from your IP
   - TCP `80` from `0.0.0.0/0`
   - TCP `443` from `0.0.0.0/0`
3. Point DNS at the VM public IP:
   - `A` record for the apex domain
   - optional `A` record for `www`

## Server Bootstrap

Run these commands on the fresh Ubuntu VM as a sudo-capable user:

```bash
sudo apt update
sudo apt install -y curl ca-certificates git nginx postgresql postgresql-contrib

curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable
sudo corepack prepare pnpm@10.15.0 --activate

sudo adduser --system --group --home /opt/tarun-astro Tarun
sudo mkdir -p /opt/tarun-astro/releases /opt/tarun-astro/current /etc/tarun-astro
sudo chown -R Tarun:Tarun /opt/tarun-astro
```

Create the production database:

```bash
sudo -u postgres createuser Tarun
sudo -u postgres createdb tarun_astro -O Tarun
sudo -u postgres psql -c "ALTER USER Tarun WITH PASSWORD 'replace-with-a-strong-db-password';"
```

## Environment

Create `/etc/tarun-astro/tarun-astro.env` as root and never commit it:

```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://tarun:replace-with-a-strong-db-password@127.0.0.1:5432/tarun_astro

NEXT_PUBLIC_SITE_URL=https://example.com
BETTER_AUTH_URL=https://example.com
BETTER_AUTH_SECRET=replace-with-openssl-rand-base64-32

TRUSTED_PROXY_PLATFORM=generic
TRUSTED_PROXY_HOPS=1

UPSTASH_REDIS_REST_URL=replace-with-upstash-rest-url
UPSTASH_REDIS_REST_TOKEN=replace-with-upstash-rest-token

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

PAYMENT_PROVIDER=razorpay
REPORT_CHECKOUT_ENABLED=false
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

AI_PROVIDER=gemini
AI_MODEL=gemini-2.5-flash
AI_PROVIDER_API_KEY=
JOBS_SECRET=

STORAGE_ENDPOINT=
STORAGE_REGION=
STORAGE_BUCKET=
STORAGE_ACCESS_KEY_ID=
STORAGE_SECRET_ACCESS_KEY=

CONFIG_ENCRYPTION_KEY=
LOG_LEVEL=info
```

Secure the file:

```bash
sudo chown root:root /etc/tarun-astro/tarun-astro.env
sudo chmod 600 /etc/tarun-astro/tarun-astro.env
```

## Deploy A Release

Clone and build as the `Tarun` user:

```bash
sudo -u Tarun git clone <repo-url> /opt/tarun-astro/releases/initial
cd /opt/tarun-astro/releases/initial
sudo -u Tarun pnpm install --frozen-lockfile
sudo -u Tarun pnpm prisma generate
sudo -u Tarun pnpm prisma migrate deploy
sudo -u Tarun pnpm build -- --webpack
sudo ln -sfn /opt/tarun-astro/releases/initial /opt/tarun-astro/current
```

Install service and Nginx config:

```bash
sudo cp deploy/oracle/tarun-astro.service /etc/systemd/system/tarun-astro.service
sudo cp deploy/oracle/nginx-tarun-astro.conf /etc/nginx/sites-available/tarun-astro
sudo ln -sfn /etc/nginx/sites-available/tarun-astro /etc/nginx/sites-enabled/tarun-astro
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl enable --now tarun-astro
sudo systemctl reload nginx
```

## HTTPS

After DNS resolves to the VM:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d example.com -d www.example.com
```

Then update `/etc/tarun-astro/tarun-astro.env` so every public URL uses the
final HTTPS origin, and restart:

```bash
sudo systemctl restart tarun-astro
```

## Verification

```bash
sudo systemctl status tarun-astro --no-pager
journalctl -u tarun-astro -n 100 --no-pager
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS https://example.com/api/health
curl -fsS https://example.com/api/readiness
```

`/api/readiness` must return `{"status":"ok"}`. If it reports
`rateLimitStore`, configure Upstash Redis REST before treating the deployment as
production-ready.

## Updating Later

Build each deployment in a new release directory, then atomically repoint the
`current` symlink:

```bash
release=/opt/tarun-astro/releases/$(date +%Y%m%d%H%M%S)
sudo -u Tarun git clone <repo-url> "$release"
cd "$release"
sudo -u Tarun pnpm install --frozen-lockfile
sudo -u Tarun pnpm prisma generate
sudo -u Tarun pnpm prisma migrate deploy
sudo -u Tarun pnpm build -- --webpack
sudo ln -sfn "$release" /opt/tarun-astro/current
sudo systemctl restart tarun-astro
curl -fsS https://example.com/api/readiness
```
