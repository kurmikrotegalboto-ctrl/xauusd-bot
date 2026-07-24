#!/usr/bin/env bash
# ============================================================
# Helper: Push XAUUSD Bot to GitHub + Deploy to Render
# Run this script locally after downloading the bundle.
# ============================================================
set -e

# --- Config ---
REPO_NAME="xauusd-bot"
REPO_DESC="XAUUSD price prediction bot with paper trading + Redis persistence"
DEFAULT_BRANCH="main"

echo "============================================================"
echo "  XAUUSD Bot — GitHub Push Helper"
echo "============================================================"
echo ""
echo "Prerequisites:"
echo "  1. Git installed (https://git-scm.com/downloads)"
echo "  2. GitHub account"
echo "  3. GitHub Personal Access Token (PAT) — classic with 'repo' scope"
echo "     → https://github.com/settings/tokens (Generate new token → classic)"
echo ""
read -p "Press Enter to continue, or Ctrl+C to abort..."

# --- Step 1: Extract bundle ---
BUNDLE="${1:-xauusd-bot-bundle.tar.gz}"
if [ ! -f "$BUNDLE" ]; then
  echo "❌ Bundle '$BUNDLE' not found in current directory."
  echo "   Make sure you're in the folder where you extracted the bundle."
  exit 1
fi

echo ""
echo "Step 1/4: Extract bundle..."
if [ -d "$REPO_NAME" ]; then
  echo "⚠️  Folder '$REPO_NAME' already exists. Using existing folder."
  cd "$REPO_NAME"
else
  tar xzf "$BUNDLE"
  cd "$REPO_NAME"
fi
echo "✓ Extracted to: $(pwd)"

# --- Step 2: GitHub credentials ---
echo ""
echo "Step 2/4: GitHub credentials"
read -p "GitHub username: " GH_USER
read -sp "GitHub Personal Access Token (hidden): " GH_TOKEN
echo ""
read -p "Repository name (default: $REPO_NAME): " INPUT_REPO
REPO_NAME="${INPUT_REPO:-$REPO_NAME}"

# --- Step 3: Create repo via GitHub API ---
echo ""
echo "Step 3/4: Creating GitHub repository..."
HTTP_CODE=$(curl -s -w "%{http_code}" -o /tmp/gh_create.json \
  -X POST \
  -H "Authorization: token $GH_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/user/repos \
  -d "{\"name\":\"$REPO_NAME\",\"description\":\"$REPO_DESC\",\"private\":false}")

if [ "$HTTP_CODE" = "201" ]; then
  echo "✓ Repository created: https://github.com/$GH_USER/$REPO_NAME"
elif [ "$HTTP_CODE" = "422" ]; then
  echo "⚠️  Repository already exists. Pushing to existing repo."
else
  echo "❌ Failed to create repo (HTTP $HTTP_CODE):"
  cat /tmp/gh_create.json
  exit 1
fi

# --- Step 4: Push ---
echo ""
echo "Step 4/4: Pushing code to GitHub..."
git remote remove origin 2>/dev/null || true
git remote add origin "https://$GH_USER:$GH_TOKEN@github.com/$GH_USER/$REPO_NAME.git"
git push -u origin "$DEFAULT_BRANCH"

# --- Done ---
echo ""
echo "============================================================"
echo "  ✅ Push complete!"
echo "============================================================"
echo ""
echo "Repository: https://github.com/$GH_USER/$REPO_NAME"
echo ""
echo "Next steps:"
echo "  1. Go to https://upstash.com → Sign up with GitHub → Create Redis DB"
echo "     → Copy connection URL (rediss://default:PASSWORD@HOST:PORT)"
echo ""
echo "  2. Go to https://render.com → Sign up with GitHub"
echo "     → New + → Blueprint → Select repo '$REPO_NAME'"
echo "     → render.yaml will be auto-detected"
echo ""
echo "  3. In Render → service 'xauusd-bot' → Environment → add:"
echo "     REDIS_URL = <paste Upstash URL from step 1>"
echo "     TWELVEDATA_API_KEY = 2f7f8b157aee4c619ce29f293d34b1cd"
echo ""
echo "  4. Save → wait for redeploy (~3-5 min)"
echo "  5. Open https://xauusd-bot.onrender.com — done!"
echo ""
echo "Full guide: see DEPLOYMENT.md"
