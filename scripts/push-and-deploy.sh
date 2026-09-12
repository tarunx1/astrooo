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

echo "--------------------------------------------------------"
echo "✅ All code pushed to GitHub (origin/main & origin/$CURRENT_BRANCH)."
echo "📡 GitHub Actions CI/CD pipeline triggered automatically."
echo "🌐 Live Deployment: https://polyphonic-passing-doc-resolutions.trycloudflare.com"
echo "--------------------------------------------------------"
