# Local System Server Deploy

Use this when this Mac is the server. This is not Oracle Cloud hosting: Oracle
will not run the app and no Oracle VM is created. Your machine runs the Next.js
process, Postgres, and reverse proxy.

For public access you need one of these:

- A domain pointing to your home/office public IP plus router port forwarding
- A tunnel provider such as Cloudflare Tunnel
- A static IP from your ISP

## Risks

- Your machine must stay powered on and connected.
- Residential IPs can change.
- Some ISPs block inbound ports `80` and `443`.
- Exposing a home machine needs careful firewall and router configuration.
- Production still requires the app's existing secrets, Postgres, and Upstash
  Redis REST.

## Install Dependencies

On macOS:

```bash
brew install node pnpm nginx postgresql@16
brew services start postgresql@16
```

Create a production database:

```bash
createdb tarun_astro
createuser Tarun
psql -d postgres -c "ALTER USER Tarun WITH PASSWORD 'replace-with-a-strong-db-password';"
psql -d postgres -c "ALTER DATABASE tarun_astro OWNER TO Tarun;"
```

## Prepare App Directory

```bash
sudo mkdir -p /opt/tarun-astro/current /opt/tarun-astro/env /opt/tarun-astro/bin /opt/tarun-astro/logs
sudo chown -R "$USER":staff /opt/tarun-astro
rsync -a --delete \
  --exclude .git \
  --exclude node_modules \
  --exclude .next \
  --exclude .env \
  "/Users/tarun/Desktop/Tarun Astro/" \
  /opt/tarun-astro/current/
cp /opt/tarun-astro/current/deploy/local-server/start-tarun-astro.sh /opt/tarun-astro/bin/start-tarun-astro.sh
chmod +x /opt/tarun-astro/bin/start-tarun-astro.sh
```

## Environment

Create `/opt/tarun-astro/env/tarun-astro.env`:

```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://tarun:replace-with-a-strong-db-password@127.0.0.1:5432/tarun_astro

NEXT_PUBLIC_SITE_URL=https://your-domain.com
BETTER_AUTH_URL=https://your-domain.com
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

Secure it:

```bash
chmod 600 /opt/tarun-astro/env/tarun-astro.env
```

## Build

```bash
cd /opt/tarun-astro/current
pnpm install --frozen-lockfile
pnpm prisma generate
pnpm prisma migrate deploy
pnpm build -- --webpack
```

## Start With launchd

```bash
cp /opt/tarun-astro/current/deploy/local-server/com.tarun-astro.app.plist ~/Library/LaunchAgents/com.tarun-astro.app.plist
launchctl unload ~/Library/LaunchAgents/com.tarun-astro.app.plist 2>/dev/null || true
launchctl load ~/Library/LaunchAgents/com.tarun-astro.app.plist
launchctl start com.tarun-astro.app
```

Check logs:

```bash
tail -f /opt/tarun-astro/logs/app.log
tail -f /opt/tarun-astro/logs/app-error.log
```

## Reverse Proxy

This template listens on `8080` so it can run without root. Copy it into the
Homebrew Nginx server directory:

```bash
mkdir -p "$(brew --prefix)/etc/nginx/servers"
cp /opt/tarun-astro/current/deploy/local-server/nginx-tarun-astro-macos.conf "$(brew --prefix)/etc/nginx/servers/tarun-astro.conf"
nginx -t
brew services restart nginx
```

Local check:

```bash
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS http://127.0.0.1:8080/api/health
```

## Make It Public

Router option:

1. Reserve this Mac's LAN IP in your router.
2. Forward public `80` and `443` to this Mac.
3. Point your domain `A` record to your public IP.
4. Change the Nginx config to listen on `80`, add your domain to `server_name`,
   and use Certbot or another TLS provider.

Tunnel option:

1. Create a tunnel to `http://127.0.0.1:3000`.
2. Point the tunnel hostname at your domain.
3. Set `NEXT_PUBLIC_SITE_URL` and `BETTER_AUTH_URL` to that HTTPS domain.
4. Restart the launchd service.

## Verify

```bash
curl -fsS https://your-domain.com/api/health
curl -fsS https://your-domain.com/api/readiness
```

`/api/readiness` must return `{"status":"ok"}`. If it names
`rateLimitStore`, configure the Upstash Redis REST variables.
