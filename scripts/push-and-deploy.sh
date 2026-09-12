#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Tarun Astro - One-Go Push & Deploy Automation Script
# ==============================================================================

COMMIT_MSG="${1:-chore(release): push and deploy latest platform updates}"
CURRENT_BRANCH="$(git symbolic-ref --short HEAD)"

echo "--------------------------------------------------------"
echo "🚀 Tarun Astro: Push and Deploy in One Go"
echo "Branch: $CURRENT_BRANCH"
echo "Commit Message: $COMMIT_MSG"
echo "--------------------------------------------------------"

# 1. Stage and Commit any uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  echo "==> Staging and committing changes..."
  git add -A
  git commit -m "$COMMIT_MSG"
else
  echo "==> Working tree already clean."
fi

# 2. Push current branch to origin
echo "==> Pushing $CURRENT_BRANCH to origin..."
git push origin "$CURRENT_BRANCH"

# 3. Fast-forward merge into main and push
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "==> Syncing with main branch..."
  git checkout main
  git merge "$CURRENT_BRANCH" --ff-only
  git push origin main
  git checkout "$CURRENT_BRANCH"
fi

# 4. Deploy directly to Production Host (astroworld.io)
SSH_KEY="$HOME/.ssh/visahouse_github_actions"
SSH_HOST="200.234.47.6"
SSH_USER="root"

if [ -f "$SSH_KEY" ]; then
  echo "==> Deploying directly to production host $SSH_HOST (astroworld.io)..."
  ssh -i "$SSH_KEY" "$SSH_USER@$SSH_HOST" "
    set -e
    cd /var/www/ravish-astro/current
    git fetch origin main
    git reset --hard origin/main
    chown -R ravishastro:ravishastro /var/www/ravish-astro/current
    sudo -u ravishastro bash -c '
      set -e
      cd /var/www/ravish-astro/current
      CI=true pnpm install --frozen-lockfile
      pnpm prisma generate
      pnpm prisma migrate deploy
      pnpm build
    '
    systemctl restart ravish-astro
  "
  echo "==> Live server restarted."
fi

echo "--------------------------------------------------------"
echo "✅ All code pushed to GitHub (origin/main & origin/$CURRENT_BRANCH)."
echo "📡 GitHub Actions CI/CD pipeline triggered."
echo "🌟 Production Server: https://www.astroworld.io"
echo "--------------------------------------------------------"
